// Standardwerte je Varianten-Typ. Werden verwendet, wenn im Formular keine
// eigene Farbe gewählt wurde. Können jederzeit erweitert/angepasst werden.
const VARIANT_DEFAULTS = {
  freelancer: {
    label: 'Freelancer',
    primaryColor: '#ff6b4a',
    fontHeading: '"Poppins", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    radius: '14px',
  },
  unternehmen: {
    label: 'Kleines Unternehmen',
    primaryColor: '#2563eb',
    fontHeading: '"Inter", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    radius: '4px',
  },
};

// Alle verfügbaren Seiten. `required: true` = kann im Formular nicht abgewählt werden.
// `available: false` = Phase 2, wird im Formular als "demnächst" angezeigt.
const PAGE_DEFINITIONS = [
  { key: 'home', label: 'Startseite (Home)', file: 'index.html', required: true, available: true },
  { key: 'ueberUns', label: 'Über uns / Team', file: 'ueber-uns.html', required: false, available: true },
  { key: 'leistungen', label: 'Leistungen / Portfolio', file: 'leistungen.html', required: false, available: true },
  { key: 'buchungen', label: 'Buchungen', file: 'buchungen.html', required: false, available: false },
  { key: 'leistungDetails', label: 'Einzelne Leistungs-Detailseiten', file: null, required: false, available: false },
  { key: 'karriere', label: 'Karriere / Stellenangebote', file: 'karriere.html', required: false, available: false },
  { key: 'blog', label: 'Blog / News', file: 'blog.html', required: false, available: false },
  { key: 'kontakt', label: 'Kontakt & Anfahrt', file: 'kontakt.html', required: false, available: true },
  { key: 'impressum', label: 'Impressum', file: 'impressum.html', required: true, available: true },
];

module.exports = { VARIANT_DEFAULTS, PAGE_DEFINITIONS };
