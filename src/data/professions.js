// Branchen-Liste fürs Formular-Dropdown. `searchTerms` sind bewusst auf Englisch,
// weil die Pexels-Bildersuche auf englische Suchbegriffe deutlich besser anschlägt.
const PROFESSIONS = [
  { key: 'personal-trainer', label: 'Personal Trainer', searchTerms: ['personal trainer gym', 'fitness coaching'] },
  { key: 'tutor', label: 'Nachhilfelehrer:in', searchTerms: ['tutoring student', 'online tutoring laptop'] },
  { key: 'sitter', label: 'Baby-/Haustiersitter:in', searchTerms: ['babysitting child', 'dog walking pet sitting'] },
  { key: 'barber', label: 'Friseur:in / Barbier', searchTerms: ['barber shop', 'hairdresser salon'] },
  { key: 'electrician', label: 'Elektriker:in / Klempner:in', searchTerms: ['electrician at work', 'plumber repair tools'] },
  { key: 'craftsman', label: 'Maler:in / Schreiner:in / Dachdecker:in / Fliesenleger:in', searchTerms: ['carpenter workshop', 'house painter renovation'] },
  { key: 'florist', label: 'Florist:in / Gärtner:in', searchTerms: ['florist flower shop', 'gardener garden work'] },
  { key: 'driving-school', label: 'Fahrschule', searchTerms: ['driving lesson car', 'driving instructor'] },
  { key: 'beauty', label: 'Massage-/Kosmetikstudio', searchTerms: ['massage spa', 'beauty salon treatment'] },
  { key: 'therapist', label: 'Therapeut:in', searchTerms: ['therapy session office', 'counseling room'] },
  { key: 'photographer', label: 'Fotograf:in', searchTerms: ['photographer camera', 'photography studio'] },
  { key: 'cleaning', label: 'Reinigungskraft', searchTerms: ['house cleaning service', 'cleaning supplies'] },
  { key: 'cafe-bakery', label: 'Café / Bäckerei', searchTerms: ['bakery bread', 'cozy cafe interior'] },
  { key: 'car-repair', label: 'Kfz-Werkstatt', searchTerms: ['car mechanic garage', 'auto repair shop'] },
  { key: 'butcher', label: 'Metzgerei', searchTerms: ['butcher shop meat', 'butcher counter'] },
  { key: 'moving', label: 'Umzugsunternehmen', searchTerms: ['moving boxes truck', 'movers carrying boxes'] },
  { key: 'bike-shop', label: 'Fahrradladen', searchTerms: ['bicycle shop', 'bike repair shop'] },
  { key: 'restaurant', label: 'Restaurant', searchTerms: ['restaurant interior', 'chef cooking kitchen'] },
  { key: 'laundry', label: 'Wäscherei / Bügelservice', searchTerms: ['laundry service', 'ironing clothes'] },
  { key: 'ice-cream', label: 'Eisdiele', searchTerms: ['ice cream shop', 'gelato shop'] },
  { key: 'gym', label: 'Fitnessstudio', searchTerms: ['gym fitness interior', 'gym equipment'] },
  { key: 'vet', label: 'Tierarztpraxis', searchTerms: ['veterinarian dog', 'vet clinic'] },
];

// Fallback, wenn keine Branche gewählt wurde ("Sonstiges") – trotzdem passende Bilder.
const GENERIC_FALLBACK = { label: 'Unternehmen', searchTerms: ['modern office team', 'small business storefront'] };

module.exports = { PROFESSIONS, GENERIC_FALLBACK };
