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

async function searchPexels(query, count, orientation, page) {
  // size=large verlangt Fotos mit mindestens ~24MP Originalauflösung, damit
  // auch die großflächigen Hero-/Panel-Ausschnitte scharf bleiben.
  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=${count}&orientation=${orientation}&size=large&page=${page || 1}`;
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

  const cacheKey = `${query}::${count}::landscape`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const photos = await searchPexels(query, count, 'landscape', 1);
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

// Für den Bild-Picker im Builder: liefert mehrere Kandidaten mit Thumbnail
// (fürs Auswahlraster) und Vollbild-URL (für die tatsächliche Website).
// `page` erlaubt "Weitere laden" (nächste 10 Pexels-Ergebnisse statt Neustart).
async function searchImageOptions(query, count, orientation, page) {
  if (!isConfigured()) return [];

  const safeOrientation = ['landscape', 'portrait', 'square'].includes(orientation) ? orientation : 'landscape';
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const cacheKey = `${query}::${count}::${safeOrientation}::${safePage}::picker`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const photos = await searchPexels(query, count, safeOrientation, safePage);
    const options = photos.map((photo) => ({
      id: photo.id,
      thumb: photo.src.medium,
      full: photo.src.large2x,
    }));
    cache.set(cacheKey, options);
    return options;
  } catch (err) {
    console.error(`Bildersuche für "${query}" fehlgeschlagen: ${err.message}`);
    cache.set(cacheKey, []);
    return [];
  }
}

module.exports = { getImages, searchImageOptions, isConfigured };
