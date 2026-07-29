(function () {
  const form = document.getElementById('builder-form');
  const submitBtn = document.getElementById('submit-btn');
  const statusMsg = document.getElementById('status-msg');

  // --- Bedingte Abschnitte ein-/ausblenden, wenn eine Seite an-/abgewählt wird ---
  document.querySelectorAll('[data-toggle]').forEach((checkbox) => {
    const target = document.getElementById(checkbox.dataset.toggle);
    checkbox.addEventListener('change', () => {
      if (target) target.hidden = !checkbox.checked;
    });
  });

  // --- Dynamische Zeilen (Team-Mitglieder, Leistungen) ---
  document.querySelectorAll('[data-add]').forEach((button) => {
    button.addEventListener('click', () => {
      const container = document.getElementById(button.dataset.add);
      const template = document.getElementById(button.dataset.template);
      const row = template.content.firstElementChild.cloneNode(true);
      row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
      container.appendChild(row);
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
})();
