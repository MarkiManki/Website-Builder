// Branchen-Liste fürs Formular-Dropdown. `searchTerms` sind bewusst auf Englisch,
// weil die Pexels-Bildersuche auf englische Suchbegriffe deutlich besser anschlägt.
// `category` steuert, unter welchem Kundentyp (Freelancer/Unternehmen) die Branche
// im Dropdown auftaucht.
const PROFESSIONS = [
  // Freelancer / Einzelperson
  { key: 'personal-trainer', label: 'Personal Trainer', category: 'freelancer', searchTerms: ['personal trainer gym', 'fitness coaching'] },
  { key: 'tutor', label: 'Nachhilfelehrer:in', category: 'freelancer', searchTerms: ['tutoring student', 'online tutoring laptop'] },
  { key: 'sitter', label: 'Baby-/Haustiersitter:in', category: 'freelancer', searchTerms: ['babysitting child', 'dog walking pet sitting'] },
  { key: 'barber', label: 'Friseur:in / Barbier', category: 'freelancer', searchTerms: ['barber shop', 'hairdresser salon'] },
  { key: 'electrician', label: 'Elektriker:in / Klempner:in', category: 'freelancer', searchTerms: ['electrician at work', 'plumber repair tools'] },
  { key: 'craftsman', label: 'Maler:in / Schreiner:in / Dachdecker:in / Fliesenleger:in', category: 'freelancer', searchTerms: ['carpenter workshop', 'house painter renovation'] },
  { key: 'florist', label: 'Florist:in / Gärtner:in', category: 'freelancer', searchTerms: ['florist flower shop', 'gardener garden work'] },
  { key: 'driving-school', label: 'Fahrschule', category: 'freelancer', searchTerms: ['driving lesson car', 'driving instructor'] },
  { key: 'beauty', label: 'Massage-/Kosmetikstudio', category: 'freelancer', searchTerms: ['massage spa', 'beauty salon treatment'] },
  { key: 'therapist', label: 'Therapeut:in', category: 'freelancer', searchTerms: ['therapy session office', 'counseling room'] },
  { key: 'photographer', label: 'Fotograf:in', category: 'freelancer', searchTerms: ['photographer camera', 'photography studio'] },
  { key: 'cleaning', label: 'Reinigungskraft', category: 'freelancer', searchTerms: ['house cleaning service', 'cleaning supplies'] },

  // Kleine Unternehmen
  { key: 'cafe-bakery', label: 'Café / Bäckerei', category: 'unternehmen', searchTerms: ['bakery bread', 'cozy cafe interior'] },
  { key: 'car-repair', label: 'Kfz-Werkstatt', category: 'unternehmen', searchTerms: ['car mechanic garage', 'auto repair shop'] },
  { key: 'butcher', label: 'Metzgerei', category: 'unternehmen', searchTerms: ['butcher shop meat', 'butcher counter'] },
  { key: 'moving', label: 'Umzugsunternehmen', category: 'unternehmen', searchTerms: ['moving boxes truck', 'movers carrying boxes'] },
  { key: 'bike-shop', label: 'Fahrradladen', category: 'unternehmen', searchTerms: ['bicycle shop', 'bike repair shop'] },
  { key: 'restaurant', label: 'Restaurant', category: 'unternehmen', searchTerms: ['restaurant interior', 'chef cooking kitchen'] },
  { key: 'laundry', label: 'Wäscherei / Bügelservice', category: 'unternehmen', searchTerms: ['laundry service', 'ironing clothes'] },
  { key: 'ice-cream', label: 'Eisdiele', category: 'unternehmen', searchTerms: ['ice cream shop', 'gelato shop'] },
  { key: 'gym', label: 'Fitnessstudio', category: 'unternehmen', searchTerms: ['gym fitness interior', 'gym equipment'] },
  { key: 'vet', label: 'Tierarztpraxis', category: 'unternehmen', searchTerms: ['veterinarian dog', 'vet clinic'] },
];

// Fallback, wenn keine Branche gewählt wurde ("Sonstiges") – trotzdem passende Bilder je Kundentyp.
const GENERIC_FALLBACK = {
  freelancer: { label: 'Freelancer', searchTerms: ['freelancer workspace', 'creative desk laptop'] },
  unternehmen: { label: 'Kleines Unternehmen', searchTerms: ['small business storefront', 'modern office team'] },
};

module.exports = { PROFESSIONS, GENERIC_FALLBACK };
