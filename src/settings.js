// In-Memory-Speicher für die Buchungs-Einstellungen (Öffnungszeiten pro
// Wochentag + Zeitraster). Wird beim ersten Aufruf mit den Werten aus dem
// Website-Builder-Formular vorbelegt (siehe seedIfEmpty) und ist danach über
// das Admin-Panel auf der Website selbst editierbar – läuft wie das gesamte
// Buchungssystem nur im Speicher des Builder-Servers (Reset bei Neustart).
const WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

let settings = null;

function defaultDay(enabled, startHour, endHour) {
  return { enabled, startHour, endHour, breakStart: null, breakEnd: null };
}

function seedIfEmpty({ startHour, endHour, slotInterval }) {
  if (settings) return settings;

  const start = Number.isFinite(startHour) ? startHour : 8;
  const end = Number.isFinite(endHour) && endHour > start ? endHour : 18;
  const interval = [15, 30, 60].includes(slotInterval) ? slotInterval : 30;

  settings = {
    slotInterval: interval,
    days: {
      mo: defaultDay(true, start, end),
      di: defaultDay(true, start, end),
      mi: defaultDay(true, start, end),
      do: defaultDay(true, start, end),
      fr: defaultDay(true, start, end),
      sa: defaultDay(false, start, end),
      so: defaultDay(false, start, end),
    },
  };
  return settings;
}

function getSettings() {
  return settings || seedIfEmpty({});
}

function updateSettings(next) {
  const current = getSettings();
  const slotInterval = [15, 30, 60].includes(next.slotInterval) ? next.slotInterval : current.slotInterval;

  const days = { ...current.days };
  if (next.days) {
    WEEKDAYS.forEach((key) => {
      const incoming = next.days[key];
      if (!incoming) return;
      const startHour = Number.isFinite(incoming.startHour) ? incoming.startHour : days[key].startHour;
      const endHour = Number.isFinite(incoming.endHour) ? incoming.endHour : days[key].endHour;
      const clampedStart = Math.min(Math.max(0, startHour), 23);
      const clampedEnd = Math.min(Math.max(clampedStart + 1, endHour), 24);

      // Mittagspause: nur übernehmen, wenn beide Werte gültig sind und
      // innerhalb der Öffnungszeit liegen – sonst gilt der Tag als
      // durchgehend geöffnet (kein Fehler, einfach keine Pause).
      let breakStart = null;
      let breakEnd = null;
      if (Number.isFinite(incoming.breakStart) && Number.isFinite(incoming.breakEnd)) {
        const bStart = Math.min(Math.max(clampedStart, incoming.breakStart), clampedEnd);
        const bEnd = Math.min(Math.max(bStart + 1, incoming.breakEnd), clampedEnd);
        if (bEnd > bStart) {
          breakStart = bStart;
          breakEnd = bEnd;
        }
      }

      days[key] = {
        enabled: !!incoming.enabled,
        startHour: clampedStart,
        endHour: clampedEnd,
        breakStart,
        breakEnd,
      };
    });
  }

  settings = { slotInterval, days };
  return settings;
}

// Liefert {enabled, startHour, endHour, slotInterval} für ein konkretes Datum
// (JS-Wochentag 0=So..6=Sa wird auf unsere Kürzel gemappt).
function getDaySettings(dateStr) {
  const current = getSettings();
  const jsDay = new Date(`${dateStr}T00:00:00`).getDay();
  const key = WEEKDAYS[(jsDay + 6) % 7];
  const day = current.days[key];
  return { ...day, slotInterval: current.slotInterval };
}

module.exports = { WEEKDAYS, seedIfEmpty, getSettings, updateSettings, getDaySettings };
