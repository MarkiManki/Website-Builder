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
  // size=large verlangt Fotos mit mindestens ~24MP Originalauflösung, damit
  // auch die großflächigen Hero-/Panel-Ausschnitte scharf bleiben.
  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape&size=large`;
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
    // large2x statt large: ca. 1880px breit statt 940px – bleibt auch bei
    // bildschirmfüllenden Hero-/Panel-Ausschnitten auf großen Monitoren scharf.
    const images = photos.map((photo) => ({ src: photo.src.large2x }));
    cache.set(cacheKey, images);
    return images;
  } catch (err) {
    console.error(`Bildersuche für "${query}" fehlgeschlagen: ${err.message}`);
    cache.set(cacheKey, []); // Fehler nicht bei jedem Tastendruck erneut anfragen
    return [];
  }
}

module.exports = { getImages, isConfigured };
