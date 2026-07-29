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

  // --- Beispieldaten ---
  const SAMPLE_DATA = {
    business: {
      name: 'Lumora Fotostudio',
      tagline: 'Fotografie, die Geschichten erzählt',
      logoText: 'Lumora',
      email: 'hallo@lumora-fotostudio.de',
      phone: '+49 30 12345678',
      address: 'Sonnenallee 42, 12045 Berlin',
    },
    primaryColor: '#e8603c',
    home: {
      headline: 'Willkommen bei Lumora Fotostudio',
      subheadline: 'Individuelle Fotografie für besondere Momente',
      introText: 'Wir begleiten Hochzeiten, Portraits und Business-Shootings mit einem Auge fürs Detail und einem Gespür für echte Emotionen.',
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
    setValue('business.name', SAMPLE_DATA.business.name);
    setValue('business.tagline', SAMPLE_DATA.business.tagline);
    setValue('business.logoText', SAMPLE_DATA.business.logoText);
    setValue('business.email', SAMPLE_DATA.business.email);
    setValue('business.phone', SAMPLE_DATA.business.phone);
    setValue('business.address', SAMPLE_DATA.business.address);
    setValue('design.primaryColor', SAMPLE_DATA.primaryColor);

    setValue('content.home.headline', SAMPLE_DATA.home.headline);
    setValue('content.home.subheadline', SAMPLE_DATA.home.subheadline);
    setValue('content.home.introText', SAMPLE_DATA.home.introText);
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

    Object.keys(SAMPLE_DATA.impressum).forEach((field) => {
      setValue(`content.impressum.${field}`, SAMPLE_DATA.impressum[field]);
    });

    statusMsg.textContent = 'Beispieldaten eingefügt.';
    statusMsg.className = 'status-msg success';
    schedulePreviewUpdate();
  }

  document.getElementById('sample-data-btn').addEventListener('click', fillSampleData);

  // Vorschau direkt beim Laden einmal aufbauen (Home + Impressum sind immer aktiv).
  schedulePreviewUpdate();
})();
