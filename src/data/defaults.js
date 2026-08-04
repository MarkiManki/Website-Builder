// Standardwerte je Varianten-Typ. Werden verwendet, wenn im Formular keine
// eigene Farbe/Schrift gewählt wurde. Können jederzeit erweitert/angepasst werden.
const VARIANT_DEFAULTS = {
  freelancer: {
    label: 'Freelancer',
    primaryColor: '#e8603c',
    radius: '18px',
    defaultFontKey: 'space-grotesk',
  },
  unternehmen: {
    label: 'Kleines Unternehmen',
    primaryColor: '#4f46e5',
    radius: '12px',
    defaultFontKey: 'sora',
  },
};

// Die 10 meistgenutzten, professionellen Google-Fonts-Kombinationen für
// Business-Websites – bewusst keine verspielten/unprofessionellen Schriften.
const FONT_PRESETS = [
  {
    key: 'inter',
    label: 'Inter – Klar & modern',
    fontHeading: '"Inter", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  },
  {
    key: 'poppins',
    label: 'Poppins – Freundlich & geometrisch',
    fontHeading: '"Poppins", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap',
  },
  {
    key: 'montserrat',
    label: 'Montserrat – Selbstbewusst',
    fontHeading: '"Montserrat", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap',
  },
  {
    key: 'space-grotesk',
    label: 'Space Grotesk – Tech & kreativ',
    fontHeading: '"Space Grotesk", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap',
  },
  {
    key: 'sora',
    label: 'Sora – Ruhig & professionell',
    fontHeading: '"Sora", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap',
  },
  {
    key: 'playfair',
    label: 'Playfair Display – Elegant & redaktionell',
    fontHeading: '"Playfair Display", Georgia, serif',
    fontBody: '"Source Sans 3", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Source+Sans+3:wght@400;500;600;700&display=swap',
  },
  {
    key: 'merriweather',
    label: 'Merriweather – Warm & vertrauenswürdig',
    fontHeading: '"Merriweather", Georgia, serif',
    fontBody: '"Karla", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@600;700&family=Karla:wght@400;500;600;700&display=swap',
  },
  {
    key: 'raleway',
    label: 'Raleway – Leicht & stilvoll',
    fontHeading: '"Raleway", "Segoe UI", sans-serif',
    fontBody: '"Nunito Sans", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Raleway:wght@500;600;700;800&family=Nunito+Sans:wght@400;500;600;700&display=swap',
  },
  {
    key: 'dm-serif',
    label: 'DM Serif Display – Boutique-Charakter',
    fontHeading: '"DM Serif Display", Georgia, serif',
    fontBody: '"DM Sans", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap',
  },
  {
    key: 'work-sans',
    label: 'Work Sans – Sachlich & zeitlos',
    fontHeading: '"Work Sans", "Segoe UI", sans-serif',
    fontBody: '"Work Sans", "Segoe UI", sans-serif',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@500;600;700;800&display=swap',
  },
];

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

module.exports = { VARIANT_DEFAULTS, FONT_PRESETS, PAGE_DEFINITIONS };
