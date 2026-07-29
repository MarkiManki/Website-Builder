// Bildersuche über die Pexels-API (kostenlos, keine Attribution nötig).
// Ohne PEXELS_API_KEY liefert dieses Modul einfach keine Bilder – der Rest
// der Website-Generierung läuft unverändert weiter (siehe README für Setup).
const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';

// Prozess-Cache: pro Suchbegriff werden Ergebnisse wiederverwendet, damit die
// Live-Vorschau (die bei jeder Eingabe neu rendert) nicht bei jedem Tastendruck
// die Pexels-Rate-Limits verbraucht.
const cache = new Map();

function isConfigured() {
  return !!process.env.PEXELS_API_KEY;
}

async function searchPexels(query, count) {
  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;
  const response = await fetch(url, {
    headers: { Authorization: process.env.PEXELS_API_KEY },
  });

  if (!response.ok) {
    throw new Error(`Pexels-API antwortete mit Status ${response.status}`);
  }

  const data = await response.json();
  return data.photos || [];
}

async function getImages(query, count) {
  if (!isConfigured()) return [];

  const cacheKey = `${query}::${count}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const photos = await searchPexels(query, count);
    const images = photos.map((photo) => ({ src: photo.src.large }));
    cache.set(cacheKey, images);
    return images;
  } catch (err) {
    console.error(`Bildersuche für "${query}" fehlgeschlagen: ${err.message}`);
    cache.set(cacheKey, []); // Fehler nicht bei jedem Tastendruck erneut anfragen
    return [];
  }
}

module.exports = { getImages, isConfigured };
