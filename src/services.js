// In-Memory-Speicher für die Leistungen (Name, Beschreibung, optionaler Preis,
// optionales Bild). Wird beim ersten Laden der Leistungen-Seite mit den im
// Website-Builder eingetragenen Leistungen vorbelegt (siehe seedIfEmpty) und
// ist danach über das Admin-Panel auf der Website selbst verwaltbar (Hinzufügen/
// Entfernen/Bearbeiten) – wie das gesamte Buchungssystem nur im Speicher des
// Builder-Servers (Reset bei Neustart).
let services = null;
let nextId = 1;

function seedIfEmpty(initialServices) {
  if (services) return services;
  services = (initialServices || []).map((s) => ({
    id: nextId++,
    name: String(s.name || '').trim(),
    description: String(s.description || '').trim(),
    price: s.price || '',
    image: s.image || '',
  }));
  return services;
}

function listServices() {
  return services || [];
}

function addService({ name, description, price, image }) {
  if (!services) services = [];
  const service = {
    id: nextId++,
    name: String(name || '').trim(),
    description: String(description || '').trim(),
    price: price || '',
    image: image || '',
  };
  services.push(service);
  return service;
}

function updateService(id, { name, description, price, image }) {
  if (!services) return null;
  const service = services.find((s) => s.id === id);
  if (!service) return null;
  if (name !== undefined) service.name = String(name).trim();
  if (description !== undefined) service.description = String(description).trim();
  if (price !== undefined) service.price = price;
  if (image !== undefined) service.image = image;
  return service;
}

function deleteService(id) {
  if (!services) return false;
  const index = services.findIndex((s) => s.id === id);
  if (index === -1) return false;
  services.splice(index, 1);
  return true;
}

module.exports = { seedIfEmpty, listServices, addService, updateService, deleteService };
