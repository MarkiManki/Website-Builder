(function () {
  const form = document.getElementById('builder-form');
  const submitBtn = document.getElementById('submit-btn');
  const statusMsg = document.getElementById('status-msg');
  const previewFrame = document.getElementById('preview-frame');

  let previewPages = {};
  let pageKeyByFile = {};
  let currentPreviewPage = 'home';
  let previewTimer = null;

  // Vorschlagsfarbe je Kundentyp (muss zu den Defaults in src/data/defaults.js passen).
  const VARIANT_PRIMARY_COLOR = { freelancer: '#e8603c', unternehmen: '#4f46e5' };
  document.querySelectorAll('input[name="type"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const colorInput = form.elements['design.primaryColor'];
      if (colorInput) colorInput.value = VARIANT_PRIMARY_COLOR[radio.value];
    });
  });

  // --- Branchen-Dropdown (steuert die automatische Bildersuche) ---
  const professionSelect = document.getElementById('profession-select');
  const imagesHint = document.getElementById('images-hint');
  let allProfessions = [];

  function currentType() {
    const checked = form.querySelector('input[name="type"]:checked');
    return checked ? checked.value : 'freelancer';
  }

  function renderProfessionOptions() {
    const type = currentType();
    const previousValue = professionSelect.value;
    professionSelect.innerHTML = '<option value="">Sonstiges / kein Schwerpunkt</option>';
    allProfessions
      .filter((profession) => profession.category === type)
      .forEach((profession) => {
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
      allProfessions = data.professions || [];
      renderProfessionOptions();
      if (imagesHint) {
        imagesHint.textContent = data.imagesEnabled
          ? 'Passende Fotos werden automatisch anhand der Branche geladen.'
          : 'Damit passende Fotos automatisch geladen werden, richtet einen kostenlosen Pexels-API-Key ein (siehe README).';
      }
    })
    .catch((err) => console.error('Branchenliste konnte nicht geladen werden:', err));

  document.querySelectorAll('input[name="type"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) renderProfessionOptions();
    });
  });

  // --- Bedingte Abschnitte ein-/ausblenden, wenn eine Seite an-/abgewählt wird ---
  document.querySelectorAll('[data-toggle]').forEach((checkbox) => {
    const target = document.getElementById(checkbox.dataset.toggle);
    checkbox.addEventListener('change', () => {
      if (target) target.hidden = !checkbox.checked;
    });
  });

  // --- Dynamische Zeilen (Team-Mitglieder, Leistungen) ---
  function addRepeatRow(containerId, templateId, values) {
    const container = document.getElementById(containerId);
    const template = document.getElementById(templateId);
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector('.btn-remove').addEventListener('click', () => {
      row.remove();
      schedulePreviewUpdate();
    });
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
    data.content.ueberUns.teamMembers = collectRepeatRows('team-members', ['name', 'role', 'text']);

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
      type: 'freelancer',
      business: {
        name: 'Lumora Fotostudio',
        tagline: 'Fotografie, die Geschichten erzählt',
        logoText: 'Lumora',
        email: 'hallo@lumora-fotostudio.de',
        phone: '+49 30 12345678',
        address: 'Sonnenallee 42, 12045 Berlin',
        profession: 'photographer',
      },
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
      type: 'freelancer',
      business: {
        name: 'FitForm Personal Training',
        tagline: 'Individuelles Training für echte Ergebnisse',
        logoText: 'FitForm',
        email: 'hallo@fitform-training.de',
        phone: '+49 176 55501234',
        address: 'Bergmannstraße 12, 20359 Hamburg',
        profession: 'personal-trainer',
      },
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
      type: 'unternehmen',
      business: {
        name: 'Bäckerei Sonnenkorn',
        tagline: 'Frisch gebacken seit 1998',
        logoText: 'Sonnenkorn',
        email: 'info@sonnenkorn-baeckerei.de',
        phone: '+49 351 4890123',
        address: 'Marktplatz 7, 01067 Dresden',
        profession: 'cafe-bakery',
      },
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
      type: 'unternehmen',
      business: {
        name: 'AutoService Wagner',
        tagline: 'Ihr Kfz-Meisterbetrieb seit 2003',
        logoText: 'Wagner',
        email: 'werkstatt@autoservice-wagner.de',
        phone: '+49 221 7789012',
        address: 'Industriestraße 34, 50735 Köln',
        profession: 'car-repair',
      },
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

  function fillSampleData() {
    const setKey = document.getElementById('sample-data-select').value;
    const SAMPLE_DATA = SAMPLE_DATA_SETS[setKey];
    if (!SAMPLE_DATA) return;

    // Kundentyp zuerst setzen: steuert Branchen-Dropdown-Optionen und Standardfarbe.
    const typeRadio = form.querySelector(`input[name="type"][value="${SAMPLE_DATA.type}"]`);
    if (typeRadio) {
      typeRadio.checked = true;
      typeRadio.dispatchEvent(new Event('change', { bubbles: true }));
    }

    setValue('business.name', SAMPLE_DATA.business.name);
    setValue('business.tagline', SAMPLE_DATA.business.tagline);
    setValue('business.logoText', SAMPLE_DATA.business.logoText);
    setValue('business.email', SAMPLE_DATA.business.email);
    setValue('business.phone', SAMPLE_DATA.business.phone);
    setValue('business.address', SAMPLE_DATA.business.address);
    setValue('business.profession', SAMPLE_DATA.business.profession);
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

    ['inhaber', 'firma', 'strasse', 'plzOrt', 'land', 'telefon', 'email', 'ustId', 'handelsregister', 'aufsichtsbehoerde', 'verantwortlicher']
      .forEach((field) => setValue(`content.impressum.${field}`, ''));
    Object.keys(SAMPLE_DATA.impressum).forEach((field) => {
      setValue(`content.impressum.${field}`, SAMPLE_DATA.impressum[field]);
    });

    statusMsg.textContent = 'Beispieldaten eingefügt.';
    statusMsg.className = 'status-msg success';
    schedulePreviewUpdate();
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
