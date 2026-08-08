(function () {
  const form = document.getElementById('builder-form');
  const submitBtn = document.getElementById('submit-btn');
  const statusMsg = document.getElementById('status-msg');
  const previewFrame = document.getElementById('preview-frame');

  let previewPages = {};
  let pageKeyByFile = {};
  let currentPreviewPage = 'home';
  let previewTimer = null;

  // --- Buchungen: Stunden-Dropdowns (von/bis) für den verfügbaren Zeitraum ---
  function populateHourSelect(select, maxHour, defaultValue) {
    if (!select) return;
    for (let h = 0; h <= maxHour; h += 1) {
      const option = document.createElement('option');
      option.value = String(h);
      option.textContent = `${String(h).padStart(2, '0')}:00 Uhr`;
      if (h === defaultValue) option.selected = true;
      select.appendChild(option);
    }
  }
  populateHourSelect(document.getElementById('buchungen-start-select'), 23, 8);
  populateHourSelect(document.getElementById('buchungen-end-select'), 24, 18);

  // --- Branchen-Dropdown (steuert die automatische Bildersuche) ---
  const professionSelect = document.getElementById('profession-select');
  const imagesHint = document.getElementById('images-hint');

  function renderProfessionOptions(professions) {
    const previousValue = professionSelect.value;
    professionSelect.innerHTML = '<option value="">Sonstiges / kein Schwerpunkt</option>';
    professions.forEach((profession) => {
      const option = document.createElement('option');
      option.value = profession.key;
      option.textContent = profession.label;
      professionSelect.appendChild(option);
    });
    if (professionSelect.querySelector(`option[value="${previousValue}"]`)) {
      professionSelect.value = previousValue;
    }
  }

  fetch('/professions')
    .then((response) => response.json())
    .then((data) => {
      renderProfessionOptions(data.professions || []);
      if (imagesHint) {
        imagesHint.textContent = data.imagesEnabled
          ? 'Passende Fotos werden automatisch anhand der Branche geladen.'
          : 'Damit passende Fotos automatisch geladen werden, richtet einen kostenlosen Pexels-API-Key ein (siehe README).';
      }
    })
    .catch((err) => console.error('Branchenliste konnte nicht geladen werden:', err));

  // --- Bedingte Abschnitte ein-/ausblenden, wenn eine Seite an-/abgewählt wird ---
  document.querySelectorAll('[data-toggle]').forEach((checkbox) => {
    const target = document.getElementById(checkbox.dataset.toggle);
    checkbox.addEventListener('change', () => {
      if (target) target.hidden = !checkbox.checked;
    });
  });

  // --- Bild-Picker: Pexels-Vorschläge (mit "weitere laden") ODER eigenes
  // Hochgeladenes Bild, direkt im Builder auswählbar (statt automatischer
  // Zufallsauswahl). Wird sowohl für die festen Seiten-Bilder als auch für
  // Team-Mitglieder-Fotos verwendet. ---
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

  function initImagePicker(root) {
    const queryInput = root.querySelector('.image-picker-query');
    const searchBtn = root.querySelector('.image-picker-search');
    const moreBtn = root.querySelector('.image-picker-more');
    const grid = root.querySelector('.image-picker-grid');
    const valueInput = root.querySelector('.image-picker-value');
    const fileInput = root.querySelector('.image-picker-file');
    const orientation = root.dataset.orientation || 'landscape';
    if (!queryInput || !searchBtn || !grid || !valueInput) return;

    let page = 1;
    let lastQuery = '';

    let uploadPreview = null;

    function clearSelection() {
      grid.querySelectorAll('.image-picker-thumb').forEach((el) => el.classList.remove('selected'));
      if (uploadPreview) {
        uploadPreview.remove();
        uploadPreview = null;
      }
    }

    function showUploadPreview(dataUrl) {
      clearSelection();
      uploadPreview = document.createElement('div');
      uploadPreview.className = 'image-picker-upload-preview';
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = '';
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.textContent = '✕ Eigenes Bild entfernen';
      clearBtn.addEventListener('click', () => {
        clearSelection();
        if (fileInput) fileInput.value = '';
        selectValue('');
      });
      uploadPreview.appendChild(img);
      uploadPreview.appendChild(clearBtn);
      root.insertBefore(uploadPreview, valueInput);
    }

    function selectValue(fullUrl) {
      valueInput.value = fullUrl;
      valueInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function selectThumb(thumbEl, fullUrl) {
      clearSelection();
      thumbEl.classList.add('selected');
      selectValue(fullUrl);
    }

    function appendMessage(text) {
      const msg = document.createElement('p');
      msg.className = 'image-picker-empty';
      msg.textContent = text;
      grid.appendChild(msg);
    }

    function appendThumbs(results) {
      grid.querySelectorAll('.image-picker-empty').forEach((el) => el.remove());
      results.forEach((photo) => {
        const thumb = document.createElement('button');
        thumb.type = 'button';
        thumb.className = 'image-picker-thumb';
        if (valueInput.value === photo.full) thumb.classList.add('selected');
        const img = document.createElement('img');
        img.src = photo.thumb;
        img.loading = 'lazy';
        img.alt = '';
        thumb.appendChild(img);
        thumb.addEventListener('click', () => selectThumb(thumb, photo.full));
        grid.appendChild(thumb);
      });
    }

    async function loadPage(query, requestedPage) {
      try {
        const response = await fetch(`/images/search?query=${encodeURIComponent(query)}&orientation=${orientation}&page=${requestedPage}`);
        const data = await response.json();
        if (!data.imagesEnabled) {
          if (moreBtn) moreBtn.hidden = true;
          appendMessage('Kein Pexels-API-Key eingerichtet (siehe README).');
          return;
        }
        if (!data.results || !data.results.length) {
          if (moreBtn) moreBtn.hidden = true;
          if (requestedPage === 1) appendMessage('Keine Ergebnisse gefunden – anderen Suchbegriff versuchen.');
          return;
        }
        appendThumbs(data.results);
        if (moreBtn) moreBtn.hidden = data.results.length < 10;
      } catch (err) {
        appendMessage('Bildersuche fehlgeschlagen.');
      }
    }

    function runSearch() {
      const query = queryInput.value.trim();
      if (!query) {
        grid.innerHTML = '';
        if (moreBtn) moreBtn.hidden = true;
        appendMessage('Suchbegriff eingeben und "Bilder laden" klicken.');
        return;
      }
      lastQuery = query;
      page = 1;
      grid.innerHTML = '';
      appendMessage('Lade Bilder…');
      loadPage(query, page).then(() => {
        grid.querySelectorAll('.image-picker-empty').forEach((el) => {
          if (el.textContent === 'Lade Bilder…') el.remove();
        });
      });
    }

    function loadMore() {
      if (!lastQuery) return;
      page += 1;
      loadPage(lastQuery, page);
    }

    searchBtn.addEventListener('click', runSearch);
    queryInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch();
      }
    });
    if (moreBtn) moreBtn.addEventListener('click', loadMore);

    // --- Eigenes Bild hochladen: als Data-URI direkt eingebettet, kein
    // Server-Upload/Storage nötig – funktioniert genauso in Vorschau & Export. ---
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
          window.alert('Bild ist zu groß (max. 5 MB). Bitte kleineres Bild wählen.');
          fileInput.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result);
          showUploadPreview(dataUrl);
          selectValue(dataUrl);
        };
        reader.readAsDataURL(file);
      });
    }
  }

  document.querySelectorAll('.image-picker').forEach(initImagePicker);

  // --- Firmenlogo: nur Upload (keine Pexels-Suche nötig), als Data-URI
  // gespeichert – ohne Upload bleibt business.logo leer und die Website
  // zeigt stattdessen automatisch ein Kürzel-Badge (siehe header.hbs). ---
  const logoInput = document.getElementById('logo-upload-input');
  const logoValue = document.getElementById('logo-value');
  const logoPreview = document.getElementById('logo-preview');
  const logoRemoveBtn = document.getElementById('logo-remove-btn');

  function setLogo(dataUrl) {
    logoValue.value = dataUrl || '';
    logoValue.dispatchEvent(new Event('change', { bubbles: true }));
    logoPreview.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="">` : '';
    if (logoRemoveBtn) logoRemoveBtn.hidden = !dataUrl;
  }

  if (logoInput) {
    logoInput.addEventListener('change', () => {
      const file = logoInput.files && logoInput.files[0];
      if (!file) return;
      if (file.size > MAX_UPLOAD_BYTES) {
        window.alert('Logo ist zu groß (max. 5 MB). Bitte kleineres Bild wählen.');
        logoInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setLogo(String(reader.result));
      reader.readAsDataURL(file);
    });
  }

  if (logoRemoveBtn) {
    logoRemoveBtn.addEventListener('click', () => {
      if (logoInput) logoInput.value = '';
      setLogo('');
    });
  }

  // --- Dynamische Zeilen (Team-Mitglieder, Leistungen) ---
  function addRepeatRow(containerId, templateId, values) {
    const container = document.getElementById(containerId);
    const template = document.getElementById(templateId);
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector('.btn-remove').addEventListener('click', () => {
      row.remove();
      schedulePreviewUpdate();
    });
    row.querySelectorAll('.image-picker').forEach(initImagePicker);
    if (values) {
      Object.keys(values).forEach((field) => {
        const input = row.querySelector(`[data-field="${field}"]`);
        if (input) input.value = values[field];
      });
    }
    container.appendChild(row);
    return row;
  }

  document.querySelectorAll('[data-add]').forEach((button) => {
    button.addEventListener('click', () => {
      addRepeatRow(button.dataset.add, button.dataset.template);
      schedulePreviewUpdate();
    });
  });

  function setPath(obj, dottedPath, value) {
    const parts = dottedPath.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }

  function collectRepeatRows(containerId, fields) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.repeat-row'))
      .map((row) => {
        const entry = {};
        fields.forEach((field) => {
          const input = row.querySelector(`[data-field="${field}"]`);
          entry[field] = input ? input.value.trim() : '';
        });
        return entry;
      })
      .filter((entry) => Object.values(entry).some((v) => v !== ''));
  }

  function buildFormData() {
    const data = {};

    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      if (el.type === 'radio') {
        if (el.checked) setPath(data, el.name, el.value);
        return;
      }
      if (el.type === 'checkbox') {
        setPath(data, el.name, el.checked);
        return;
      }
      setPath(data, el.name, el.value);
    });

    data.content = data.content || {};
    data.content.ueberUns = data.content.ueberUns || {};
    data.content.ueberUns.teamMembers = collectRepeatRows('team-members', ['name', 'role', 'text', 'photo']);

    data.content.leistungen = data.content.leistungen || {};
    data.content.leistungen.services = collectRepeatRows('services', ['name', 'description']);

    return data;
  }

  // --- Live-Vorschau ---
  function schedulePreviewUpdate() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 400);
  }

  function renderPreviewFrame() {
    const html = previewPages[currentPreviewPage];
    if (html) previewFrame.srcdoc = html;
  }

  async function updatePreview() {
    try {
      const payload = buildFormData();
      const response = await fetch('/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return;

      const data = await response.json();
      previewPages = data.pages || {};
      pageKeyByFile = data.pageKeyByFile || {};

      if (!previewPages[currentPreviewPage]) {
        currentPreviewPage = data.defaultPage || 'home';
      }
      renderPreviewFrame();
    } catch (err) {
      // Vorschau ist ein Komfort-Feature – Fehler hier blockieren den restlichen Ablauf nicht.
      console.error('Vorschau konnte nicht aktualisiert werden:', err);
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== previewFrame.contentWindow) return;
    if (!event.data || event.data.source !== 'website-builder-preview') return;
    const key = pageKeyByFile[event.data.href];
    if (key && previewPages[key]) {
      currentPreviewPage = key;
      renderPreviewFrame();
    }
  });

  document.querySelectorAll('[data-preview-width]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-preview-width]').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      previewFrame.classList.toggle('mobile-width', button.dataset.previewWidth === '375');
    });
  });

  form.addEventListener('input', schedulePreviewUpdate);
  form.addEventListener('change', schedulePreviewUpdate);

  function filenameFromDisposition(header, fallback) {
    if (!header) return fallback;
    const match = /filename="?([^"]+)"?/.exec(header);
    return match ? match[1] : fallback;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    statusMsg.textContent = 'Website wird generiert…';
    statusMsg.className = 'status-msg';

    try {
      const payload = buildFormData();
      const response = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.details || errBody.error || `Serverfehler (${response.status})`);
      }

      const blob = await response.blob();
      const filename = filenameFromDisposition(response.headers.get('Content-Disposition'), 'website.zip');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      statusMsg.textContent = 'Fertig! ZIP wurde heruntergeladen.';
      statusMsg.className = 'status-msg success';
    } catch (err) {
      statusMsg.textContent = `Fehler: ${err.message}`;
      statusMsg.className = 'status-msg error';
    } finally {
      submitBtn.disabled = false;
    }
  });

  // --- Beispieldaten (mehrere Sets zur Auswahl, für schnellen Vergleich) ---
  const SAMPLE_DATA_SETS = {
    photographer: {
      business: {
        name: 'Lumora Fotostudio',
        tagline: 'Fotografie, die Geschichten erzählt',
        logoText: 'Lumora',
        email: 'hallo@lumora-fotostudio.de',
        phone: '+49 30 12345678',
        address: 'Sonnenallee 42, 12045 Berlin',
        profession: 'photographer',
        social: {
          facebook: 'https://facebook.com/lumorafotostudio',
          instagram: 'https://instagram.com/lumorafotostudio',
          x: '',
          linkedin: '',
          tiktok: 'https://tiktok.com/@lumorafotostudio',
          youtube: 'https://youtube.com/@lumorafotostudio',
        },
      },
      logoQuery: 'camera logo icon',
      primaryColor: '#e8603c',
      home: {
        headline: 'Willkommen bei Lumora Fotostudio',
        subheadline: 'Individuelle Fotografie für besondere Momente',
        ctaText: 'Termin anfragen',
        ctaLink: 'kontakt.html',
      },
      ueberUns: {
        title: 'Über uns',
        text: 'Seit 2016 halten wir mit Herz und Kamera die schönsten Momente unserer Kund:innen fest.',
        team: [
          { name: 'Anna Berger', role: 'Fotografin & Gründerin', text: 'Spezialisiert auf natürliche Portraits.' },
          { name: 'Jonas Weber', role: 'Fotograf', text: 'Experte für Hochzeits- und Eventfotografie.' },
        ],
      },
      leistungen: {
        title: 'Unsere Leistungen',
        intro: 'Von der ersten Idee bis zum fertigen Bild – das bieten wir an:',
        services: [
          { name: 'Hochzeitsfotografie', description: 'Der schönste Tag Ihres Lebens, authentisch festgehalten.' },
          { name: 'Portraitshootings', description: 'Individuelle Portraits für Bewerbung, Business oder privat.' },
          { name: 'Eventfotografie', description: 'Firmenfeiern, Geburtstage und besondere Anlässe.' },
        ],
      },
      kontakt: {
        title: 'Kontakt',
        intro: 'Wir freuen uns auf Ihre Nachricht – meldet euch gerne unverbindlich.',
        openingHours: 'Mo–Fr 9:00–18:00 Uhr, Termine nach Vereinbarung',
      },
      buchungen: {
        title: 'Fototermin buchen',
        intro: 'Sichern Sie sich Ihren Termin für ein Fotoshooting.',
        startHour: 9,
        endHour: 18,
        slotInterval: 60,
      },
      impressum: {
        inhaber: 'Anna Berger',
        firma: 'Lumora Fotostudio',
        strasse: 'Sonnenallee 42',
        plzOrt: '12045 Berlin',
        land: 'Deutschland',
        telefon: '+49 30 12345678',
        email: 'hallo@lumora-fotostudio.de',
        ustId: 'DE987654321',
        verantwortlicher: 'Anna Berger, Sonnenallee 42, 12045 Berlin',
      },
    },

    'personal-trainer': {
      business: {
        name: 'FitForm Personal Training',
        tagline: 'Individuelles Training für echte Ergebnisse',
        logoText: 'FitForm',
        email: 'hallo@fitform-training.de',
        phone: '+49 176 55501234',
        address: 'Bergmannstraße 12, 20359 Hamburg',
        profession: 'personal-trainer',
        social: {
          facebook: '',
          instagram: 'https://instagram.com/fitform.training',
          x: '',
          linkedin: '',
        },
      },
      logoQuery: 'fitness gym logo icon',
      primaryColor: '#e8603c',
      home: {
        headline: 'Erreiche deine Ziele mit FitForm',
        subheadline: 'Personal Training, das zu deinem Leben passt',
        ctaText: 'Kostenloses Erstgespräch',
        ctaLink: 'kontakt.html',
      },
      ueberUns: {
        title: 'Über mich',
        text: 'Seit 8 Jahren begleite ich Menschen auf dem Weg zu mehr Fitness und Wohlbefinden – individuell, ehrlich, auf Augenhöhe.',
        team: [
          { name: 'Jonas Keller', role: 'Personal Trainer, B.Sc. Sportwissenschaft', text: 'Spezialisiert auf Kraft- und Athletiktraining.' },
        ],
      },
      leistungen: {
        title: 'Trainingsangebote',
        intro: 'Das biete ich an:',
        services: [
          { name: '1:1 Personal Training', description: 'Individuelles Training, ganz auf dich abgestimmt.' },
          { name: 'Ernährungsberatung', description: 'Praktische Begleitung für nachhaltige Ergebnisse.' },
          { name: 'Online Coaching', description: 'Trainingspläne und Betreuung, ortsunabhängig.' },
        ],
      },
      kontakt: {
        title: 'Kontakt',
        intro: 'Schreib mir für ein kostenloses Erstgespräch.',
        openingHours: 'Mo–Sa 7:00–20:00 Uhr, Termine nach Vereinbarung',
      },
      buchungen: {
        title: 'Trainingstermin buchen',
        intro: 'Wähle deinen Termin für ein Personal-Training.',
        startHour: 7,
        endHour: 20,
        slotInterval: 60,
      },
      impressum: {
        inhaber: 'Jonas Keller',
        firma: 'FitForm Personal Training',
        strasse: 'Bergmannstraße 12',
        plzOrt: '20359 Hamburg',
        land: 'Deutschland',
        telefon: '+49 176 55501234',
        email: 'hallo@fitform-training.de',
        ustId: '',
        verantwortlicher: 'Jonas Keller, Bergmannstraße 12, 20359 Hamburg',
      },
    },

    'cafe-bakery': {
      business: {
        name: 'Bäckerei Sonnenkorn',
        tagline: 'Frisch gebacken seit 1998',
        logoText: 'Sonnenkorn',
        email: 'info@sonnenkorn-baeckerei.de',
        phone: '+49 351 4890123',
        address: 'Marktplatz 7, 01067 Dresden',
        profession: 'cafe-bakery',
        social: {
          facebook: 'https://facebook.com/baeckerei.sonnenkorn',
          instagram: 'https://instagram.com/baeckerei.sonnenkorn',
          x: '',
          linkedin: '',
        },
      },
      logoQuery: 'bakery logo icon',
      primaryColor: '#4f46e5',
      home: {
        headline: 'Willkommen bei Bäckerei Sonnenkorn',
        subheadline: 'Handwerksbäckerei mit Herz und Tradition',
        ctaText: 'Öffnungszeiten & Anfahrt',
        ctaLink: 'kontakt.html',
      },
      ueberUns: {
        title: 'Über uns',
        text: 'Seit über 25 Jahren führen wir unsere Bäckerei als Familienbetrieb in dritter Generation.',
        team: [
          { name: 'Petra Sonnenkorn', role: 'Bäckermeisterin & Inhaberin', text: 'Führt den Betrieb in dritter Generation.' },
          { name: 'Markus Sonnenkorn', role: 'Konditormeister', text: 'Verantwortlich für Torten und Feingebäck.' },
        ],
      },
      leistungen: {
        title: 'Unser Angebot',
        intro: 'Das gibt es bei uns:',
        services: [
          { name: 'Frisches Brot & Brötchen', description: 'Täglich frisch gebacken, viele Sorten.' },
          { name: 'Kuchen & Torten', description: 'Auch nach individueller Bestellung fürs Fest.' },
          { name: 'Frühstück & Snacks', description: 'Zum Mitnehmen oder Genießen vor Ort.' },
        ],
      },
      kontakt: {
        title: 'Kontakt & Anfahrt',
        intro: 'Wir freuen uns auf Ihren Besuch.',
        openingHours: 'Di–Sa 6:00–18:00 Uhr, So 7:00–12:00 Uhr, Mo Ruhetag',
      },
      buchungen: {
        title: 'Tisch reservieren',
        intro: 'Reservieren Sie Ihren Tisch bei uns – für Frühstück, Kaffee oder Kuchen.',
        startHour: 8,
        endHour: 18,
        slotInterval: 30,
      },
      impressum: {
        inhaber: 'Petra Sonnenkorn',
        firma: 'Bäckerei Sonnenkorn GmbH',
        strasse: 'Marktplatz 7',
        plzOrt: '01067 Dresden',
        land: 'Deutschland',
        telefon: '+49 351 4890123',
        email: 'info@sonnenkorn-baeckerei.de',
        ustId: 'DE812345678',
        handelsregister: 'Amtsgericht Dresden, HRB 45678',
        verantwortlicher: 'Petra Sonnenkorn, Marktplatz 7, 01067 Dresden',
      },
    },

    'car-repair': {
      business: {
        name: 'AutoService Wagner',
        tagline: 'Ihr Kfz-Meisterbetrieb seit 2003',
        logoText: 'Wagner',
        email: 'werkstatt@autoservice-wagner.de',
        phone: '+49 221 7789012',
        address: 'Industriestraße 34, 50735 Köln',
        profession: 'car-repair',
        social: {
          facebook: 'https://facebook.com/autoservicewagner',
          instagram: '',
          x: '',
          linkedin: 'https://linkedin.com/company/autoservice-wagner',
        },
      },
      logoQuery: 'garage car repair logo icon',
      primaryColor: '#4f46e5',
      home: {
        headline: 'AutoService Wagner – Ihre Werkstatt in Köln',
        subheadline: 'Reparatur, Wartung und Reifenservice aus einer Hand',
        ctaText: 'Termin vereinbaren',
        ctaLink: 'kontakt.html',
      },
      ueberUns: {
        title: 'Über uns',
        text: 'Seit über 20 Jahren sind wir die vertrauensvolle Werkstatt für Kund:innen in Köln und Umgebung.',
        team: [
          { name: 'Stefan Wagner', role: 'Kfz-Meister & Inhaber', text: 'Über 25 Jahre Erfahrung im Kfz-Handwerk.' },
          { name: 'Deniz Yildiz', role: 'Kfz-Mechatroniker', text: 'Spezialist für Elektronik und Diagnose.' },
        ],
      },
      leistungen: {
        title: 'Unsere Leistungen',
        intro: 'Das bieten wir an:',
        services: [
          { name: 'Inspektion & Wartung', description: 'Nach Herstellervorgaben, alle Marken.' },
          { name: 'Reifenservice', description: 'Reifenwechsel, Einlagerung, Auswuchten.' },
          { name: 'Unfallreparatur', description: 'Karosserie- und Lackarbeiten aus einer Hand.' },
        ],
      },
      kontakt: {
        title: 'Kontakt',
        intro: 'Vereinbaren Sie einen Termin – wir beraten Sie gerne.',
        openingHours: 'Mo–Fr 7:30–18:00 Uhr, Sa 9:00–13:00 Uhr',
      },
      buchungen: {
        title: 'Werkstatttermin buchen',
        intro: 'Vereinbaren Sie einen Termin für Wartung oder Reparatur.',
        startHour: 8,
        endHour: 17,
        slotInterval: 30,
      },
      impressum: {
        inhaber: 'Stefan Wagner',
        firma: 'AutoService Wagner GmbH',
        strasse: 'Industriestraße 34',
        plzOrt: '50735 Köln',
        land: 'Deutschland',
        telefon: '+49 221 7789012',
        email: 'werkstatt@autoservice-wagner.de',
        ustId: 'DE756412398',
        handelsregister: 'Amtsgericht Köln, HRB 98123',
        verantwortlicher: 'Stefan Wagner, Industriestraße 34, 50735 Köln',
      },
    },

    barber: {
      business: {
        name: 'Kammer & Klinge Barbershop',
        tagline: 'Klassischer Herrenschnitt, moderner Stil',
        logoText: 'Kammer & Klinge',
        email: 'termin@kammerklinge.de',
        phone: '+49 40 33221100',
        address: 'Schulterblatt 22, 20357 Hamburg',
        profession: 'barber',
        social: {
          facebook: 'https://facebook.com/kammerklinge',
          instagram: 'https://instagram.com/kammerklinge',
          x: '',
          linkedin: '',
          tiktok: 'https://tiktok.com/@kammerklinge',
          youtube: '',
        },
      },
      logoQuery: 'barber shop logo icon',
      primaryColor: '#e8603c',
      home: {
        headline: 'Willkommen bei Kammer & Klinge',
        subheadline: 'Klassischer Herrenschnitt, modern interpretiert',
        ctaText: 'Termin buchen',
        ctaLink: 'buchungen.html',
      },
      ueberUns: {
        title: 'Über uns',
        text: 'Seit 2018 verbinden wir traditionelles Barbierhandwerk mit modernem Stil.',
        team: [
          { name: 'Kevin Brandt', role: 'Barbier & Inhaber', text: 'Spezialist für Fades und Bartpflege.' },
        ],
      },
      leistungen: {
        title: 'Unsere Leistungen',
        intro: 'Das bieten wir an:',
        services: [
          { name: 'Herrenschnitt', description: 'Klassisch oder modern, ganz nach Wunsch.' },
          { name: 'Bartpflege', description: 'Trimmen, Rasur und Pflege.' },
          { name: 'Kinderhaarschnitt', description: 'Entspannt für die Kleinen.' },
        ],
      },
      kontakt: {
        title: 'Kontakt',
        intro: 'Wir freuen uns auf Ihren Besuch.',
        openingHours: 'Di–Sa 9:00–19:00 Uhr',
      },
      buchungen: {
        title: 'Termin buchen',
        intro: 'Buchen Sie Ihren Friseurtermin ganz einfach online.',
        startHour: 9,
        endHour: 19,
        slotInterval: 30,
      },
      impressum: {
        inhaber: 'Kevin Brandt',
        firma: 'Kammer & Klinge Barbershop',
        strasse: 'Schulterblatt 22',
        plzOrt: '20357 Hamburg',
        land: 'Deutschland',
        telefon: '+49 40 33221100',
        email: 'termin@kammerklinge.de',
        ustId: '',
        verantwortlicher: 'Kevin Brandt, Schulterblatt 22, 20357 Hamburg',
      },
    },

    beauty: {
      business: {
        name: 'Studio Lumina',
        tagline: 'Wellness & Beauty für Körper und Geist',
        logoText: 'Lumina',
        email: 'info@studio-lumina.de',
        phone: '+49 89 44556677',
        address: 'Leopoldstraße 55, 80802 München',
        profession: 'beauty',
        social: {
          facebook: '',
          instagram: 'https://instagram.com/studiolumina',
          x: '',
          linkedin: '',
        },
      },
      logoQuery: 'spa wellness logo icon',
      primaryColor: '#4f46e5',
      home: {
        headline: 'Willkommen im Studio Lumina',
        subheadline: 'Ihre Auszeit für Wellness und Schönheit',
        ctaText: 'Behandlung buchen',
        ctaLink: 'buchungen.html',
      },
      ueberUns: {
        title: 'Über uns',
        text: 'Seit 2015 verwöhnen wir unsere Gäste mit individuellen Beauty- und Massage-Anwendungen.',
        team: [
          { name: 'Sophie Klein', role: 'Kosmetikerin & Inhaberin', text: 'Expertin für Gesichtsbehandlungen.' },
          { name: 'Nina Braun', role: 'Massagetherapeutin', text: 'Spezialisiert auf klassische Massagen.' },
        ],
      },
      leistungen: {
        title: 'Unsere Behandlungen',
        intro: 'Das bieten wir an:',
        services: [
          { name: 'Gesichtsbehandlung', description: 'Individuell abgestimmt auf Ihren Hauttyp.' },
          { name: 'Klassische Massage', description: 'Entspannung für Körper und Geist.' },
          { name: 'Maniküre & Pediküre', description: 'Gepflegte Hände und Füße.' },
        ],
      },
      kontakt: {
        title: 'Kontakt',
        intro: 'Wir freuen uns auf Ihre Anfrage.',
        openingHours: 'Mo–Sa 9:00–20:00 Uhr',
      },
      buchungen: {
        title: 'Behandlung buchen',
        intro: 'Reservieren Sie Ihre Wellness-Behandlung ganz bequem online.',
        startHour: 9,
        endHour: 20,
        slotInterval: 30,
      },
      impressum: {
        inhaber: 'Sophie Klein',
        firma: 'Studio Lumina',
        strasse: 'Leopoldstraße 55',
        plzOrt: '80802 München',
        land: 'Deutschland',
        telefon: '+49 89 44556677',
        email: 'info@studio-lumina.de',
        ustId: 'DE223344556',
        verantwortlicher: 'Sophie Klein, Leopoldstraße 55, 80802 München',
      },
    },

    vet: {
      business: {
        name: 'Tierarztpraxis Amrein',
        tagline: 'Liebevolle Betreuung für Ihre Tiere',
        logoText: 'Amrein',
        email: 'praxis@tierarzt-amrein.de',
        phone: '+49 711 998877',
        address: 'Rotebühlstraße 88, 70197 Stuttgart',
        profession: 'vet',
        social: {
          facebook: 'https://facebook.com/tierarztamrein',
          instagram: '',
          x: '',
          linkedin: '',
        },
      },
      logoQuery: 'veterinary clinic logo icon',
      primaryColor: '#4f46e5',
      home: {
        headline: 'Willkommen bei Tierarztpraxis Amrein',
        subheadline: 'Kompetente tierärztliche Versorgung mit Herz',
        ctaText: 'Termin vereinbaren',
        ctaLink: 'buchungen.html',
      },
      ueberUns: {
        title: 'Über uns',
        text: 'Seit 2010 kümmern wir uns mit Fachwissen und Empathie um das Wohl Ihrer Tiere.',
        team: [
          { name: 'Dr. Lena Amrein', role: 'Tierärztin & Praxisinhaberin', text: 'Spezialisiert auf Kleintiermedizin.' },
        ],
      },
      leistungen: {
        title: 'Unsere Leistungen',
        intro: 'Das bieten wir an:',
        services: [
          { name: 'Vorsorge & Impfungen', description: 'Regelmäßige Check-ups für Ihr Tier.' },
          { name: 'Diagnostik', description: 'Moderne Untersuchungsmethoden vor Ort.' },
          { name: 'Chirurgie', description: 'Operative Eingriffe in vertrauensvoller Umgebung.' },
        ],
      },
      kontakt: {
        title: 'Kontakt',
        intro: 'Im Notfall rufen Sie uns bitte direkt an.',
        openingHours: 'Mo–Fr 8:00–18:00 Uhr, Sa 9:00–12:00 Uhr',
      },
      buchungen: {
        title: 'Termin vereinbaren',
        intro: 'Vereinbaren Sie einen Termin für Ihr Tier – wir melden uns zur Bestätigung.',
        startHour: 8,
        endHour: 18,
        slotInterval: 30,
      },
      impressum: {
        inhaber: 'Dr. Lena Amrein',
        firma: 'Tierarztpraxis Amrein',
        strasse: 'Rotebühlstraße 88',
        plzOrt: '70197 Stuttgart',
        land: 'Deutschland',
        telefon: '+49 711 998877',
        email: 'praxis@tierarzt-amrein.de',
        ustId: '',
        verantwortlicher: 'Dr. Lena Amrein, Rotebühlstraße 88, 70197 Stuttgart',
      },
    },

    restaurant: {
      business: {
        name: 'Ristorante Bellavia',
        tagline: 'Italienische Küche mit Leidenschaft',
        logoText: 'Bellavia',
        email: 'reservierung@bellavia-restaurant.de',
        phone: '+49 211 776655',
        address: 'Ratinger Straße 14, 40213 Düsseldorf',
        profession: 'restaurant',
        social: {
          facebook: 'https://facebook.com/bellaviarestaurant',
          instagram: 'https://instagram.com/bellaviarestaurant',
          x: '',
          linkedin: '',
        },
      },
      logoQuery: 'italian restaurant logo icon',
      primaryColor: '#e8603c',
      home: {
        headline: 'Willkommen im Ristorante Bellavia',
        subheadline: 'Authentische italienische Küche in Düsseldorf',
        ctaText: 'Tisch reservieren',
        ctaLink: 'buchungen.html',
      },
      ueberUns: {
        title: 'Über uns',
        text: 'Seit 2012 verwöhnen wir unsere Gäste mit traditionellen italienischen Rezepten.',
        team: [
          { name: 'Marco Rossi', role: 'Küchenchef & Inhaber', text: 'Gebürtig aus der Toskana, seit 20 Jahren in der Gastronomie.' },
        ],
      },
      leistungen: {
        title: 'Unser Angebot',
        intro: 'Das erwartet Sie bei uns:',
        services: [
          { name: 'Pasta & Risotto', description: 'Hausgemacht, nach original italienischen Rezepten.' },
          { name: 'Steinofen-Pizza', description: 'Knusprig aus dem Steinofen.' },
          { name: 'Weinauswahl', description: 'Ausgewählte italienische Weine.' },
        ],
      },
      kontakt: {
        title: 'Kontakt & Anfahrt',
        intro: 'Wir freuen uns auf Ihren Besuch.',
        openingHours: 'Di–So 12:00–23:00 Uhr, Mo Ruhetag',
      },
      buchungen: {
        title: 'Tisch reservieren',
        intro: 'Reservieren Sie Ihren Tisch bequem online.',
        startHour: 11,
        endHour: 22,
        slotInterval: 30,
      },
      impressum: {
        inhaber: 'Marco Rossi',
        firma: 'Ristorante Bellavia GmbH',
        strasse: 'Ratinger Straße 14',
        plzOrt: '40213 Düsseldorf',
        land: 'Deutschland',
        telefon: '+49 211 776655',
        email: 'reservierung@bellavia-restaurant.de',
        ustId: 'DE334455667',
        handelsregister: 'Amtsgericht Düsseldorf, HRB 55443',
        verantwortlicher: 'Marco Rossi, Ratinger Straße 14, 40213 Düsseldorf',
      },
    },
  };

  function setValue(name, value) {
    const el = form.elements[name];
    if (el) el.value = value;
  }

  function checkAndReveal(checkboxName, sectionId) {
    const checkbox = form.elements[checkboxName];
    if (!checkbox) return;
    checkbox.checked = true;
    const section = document.getElementById(sectionId);
    if (section) section.hidden = false;
  }

  // Sucht ein zufälliges Vorschaubild bei Pexels (Suchbegriff je Sample-Set)
  // und nutzt es als Firmenlogo fürs Mockup, statt das Feld leer zu lassen.
  async function fetchSampleLogo(query) {
    if (!query) return '';
    try {
      const response = await fetch(`/images/search?query=${encodeURIComponent(query)}&orientation=square&page=1`);
      const data = await response.json();
      if (!data.imagesEnabled || !data.results || !data.results.length) return '';
      const pick = data.results[Math.floor(Math.random() * data.results.length)];
      return pick.thumb || '';
    } catch (err) {
      console.error('Zufallslogo konnte nicht geladen werden:', err);
      return '';
    }
  }

  // Legt ein paar Demo-Termine in den nächsten 30 Tagen an (verschiedene Tage/
  // Uhrzeiten, passend zum Zeitraster des jeweiligen Beispiel-Sets), damit der
  // Admin-Kalender beim Ausprobieren nicht leer aussieht. skipEmail:true, damit
  // dabei keine Test-Bestätigungsmails erzeugt werden.
  const DEMO_CUSTOMERS = [
    { name: 'Anna Keller', email: 'anna.keller@example.com' },
    { name: 'Tom Fischer', email: 'tom.fischer@example.com' },
    { name: 'Laura Weiß', email: 'laura.weiss@example.com' },
    { name: 'Jonas Bauer', email: 'jonas.bauer@example.com' },
    { name: 'Mia Schulz', email: 'mia.schulz@example.com' },
    { name: 'Paul Hoffmann', email: 'paul.hoffmann@example.com' },
  ];

  function buildSlotList(startHour, endHour, interval) {
    const slots = [];
    for (let m = startHour * 60; m < endHour * 60; m += interval) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }

  async function seedDemoBookings(buchungenSettings) {
    const slots = buildSlotList(buchungenSettings.startHour, buchungenSettings.endHour, buchungenSettings.slotInterval);
    if (!slots.length) return;

    const usedSlots = new Set();
    const requests = [];
    const count = 6;

    for (let i = 0; i < count; i += 1) {
      let dayOffset;
      let time;
      let key;
      let attempts = 0;
      do {
        dayOffset = 1 + Math.floor(Math.random() * 29);
        time = slots[Math.floor(Math.random() * slots.length)];
        key = `${dayOffset}::${time}`;
        attempts += 1;
      } while (usedSlots.has(key) && attempts < 20);
      usedSlots.add(key);

      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().slice(0, 10);
      const customer = DEMO_CUSTOMERS[Math.floor(Math.random() * DEMO_CUSTOMERS.length)];

      // Mix aus bereits bestätigten und noch offenen Anfragen, damit der
      // Admin-Kalender die beiden Zustände direkt zeigt (siehe Anfragen-Tab).
      const demoStatus = i < 4 ? 'confirmed' : 'pending';

      requests.push(
        fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customer.name,
            email: customer.email,
            date: dateStr,
            time,
            note: 'Beispieltermin',
            skipEmail: true,
            status: demoStatus,
          }),
        }).catch(() => {})
      );
    }

    await Promise.all(requests);
  }

  async function fillSampleData() {
    const setKey = document.getElementById('sample-data-select').value;
    const SAMPLE_DATA = SAMPLE_DATA_SETS[setKey];
    if (!SAMPLE_DATA) return;

    const logoUrl = await fetchSampleLogo(SAMPLE_DATA.logoQuery);
    setLogo(logoUrl);

    setValue('business.name', SAMPLE_DATA.business.name);
    setValue('business.tagline', SAMPLE_DATA.business.tagline);
    setValue('business.logoText', SAMPLE_DATA.business.logoText);
    setValue('business.email', SAMPLE_DATA.business.email);
    setValue('business.phone', SAMPLE_DATA.business.phone);
    setValue('business.address', SAMPLE_DATA.business.address);
    setValue('business.profession', SAMPLE_DATA.business.profession);
    ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube'].forEach((platform) => {
      setValue(`business.social.${platform}`, (SAMPLE_DATA.business.social && SAMPLE_DATA.business.social[platform]) || '');
    });
    setValue('design.primaryColor', SAMPLE_DATA.primaryColor);

    setValue('content.home.headline', SAMPLE_DATA.home.headline);
    setValue('content.home.subheadline', SAMPLE_DATA.home.subheadline);
    setValue('content.home.ctaText', SAMPLE_DATA.home.ctaText);
    setValue('content.home.ctaLink', SAMPLE_DATA.home.ctaLink);

    checkAndReveal('pages.ueberUns', 'section-ueberUns');
    setValue('content.ueberUns.title', SAMPLE_DATA.ueberUns.title);
    setValue('content.ueberUns.text', SAMPLE_DATA.ueberUns.text);
    document.getElementById('team-members').innerHTML = '';
    SAMPLE_DATA.ueberUns.team.forEach((member) => addRepeatRow('team-members', 'team-member-template', member));

    checkAndReveal('pages.leistungen', 'section-leistungen');
    setValue('content.leistungen.title', SAMPLE_DATA.leistungen.title);
    setValue('content.leistungen.intro', SAMPLE_DATA.leistungen.intro);
    document.getElementById('services').innerHTML = '';
    SAMPLE_DATA.leistungen.services.forEach((service) => addRepeatRow('services', 'service-template', service));

    checkAndReveal('pages.kontakt', 'section-kontakt');
    setValue('content.kontakt.title', SAMPLE_DATA.kontakt.title);
    setValue('content.kontakt.intro', SAMPLE_DATA.kontakt.intro);
    setValue('content.kontakt.openingHours', SAMPLE_DATA.kontakt.openingHours);

    setValue('content.buchungen.title', SAMPLE_DATA.buchungen.title);
    setValue('content.buchungen.intro', SAMPLE_DATA.buchungen.intro);
    setValue('content.buchungen.startHour', String(SAMPLE_DATA.buchungen.startHour));
    setValue('content.buchungen.endHour', String(SAMPLE_DATA.buchungen.endHour));
    setValue('content.buchungen.slotInterval', String(SAMPLE_DATA.buchungen.slotInterval));

    ['inhaber', 'firma', 'strasse', 'plzOrt', 'land', 'telefon', 'email', 'ustId', 'handelsregister', 'aufsichtsbehoerde', 'verantwortlicher']
      .forEach((field) => setValue(`content.impressum.${field}`, ''));
    Object.keys(SAMPLE_DATA.impressum).forEach((field) => {
      setValue(`content.impressum.${field}`, SAMPLE_DATA.impressum[field]);
    });

    statusMsg.textContent = 'Beispieldaten eingefügt. Lege Demo-Termine an…';
    statusMsg.className = 'status-msg success';
    schedulePreviewUpdate();

    seedDemoBookings(SAMPLE_DATA.buchungen)
      .then(() => {
        statusMsg.textContent = 'Beispieldaten eingefügt, inkl. Demo-Terminen für den Admin-Kalender.';
      })
      .catch((err) => {
        console.error('Demo-Termine konnten nicht angelegt werden:', err);
      });
  }

  document.getElementById('sample-data-btn').addEventListener('click', fillSampleData);

  // --- Im Browser öffnen (schreibt die aktuelle Version auf die Platte und öffnet sie in einem neuen Tab) ---
  const openBrowserBtn = document.getElementById('open-browser-btn');
  openBrowserBtn.addEventListener('click', async () => {
    openBrowserBtn.disabled = true;
    statusMsg.textContent = 'Website wird vorbereitet…';
    statusMsg.className = 'status-msg';

    try {
      const payload = buildFormData();
      const response = await fetch('/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.details || errBody.error || `Serverfehler (${response.status})`);
      }

      const data = await response.json();
      window.open(data.url, '_blank');
      statusMsg.textContent = 'Website in neuem Tab geöffnet.';
      statusMsg.className = 'status-msg success';
    } catch (err) {
      statusMsg.textContent = `Fehler: ${err.message}`;
      statusMsg.className = 'status-msg error';
    } finally {
      openBrowserBtn.disabled = false;
    }
  });

  // Vorschau direkt beim Laden einmal aufbauen (Home + Impressum sind immer aktiv).
  schedulePreviewUpdate();
})();
