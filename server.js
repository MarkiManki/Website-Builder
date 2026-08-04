require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const archiver = require('archiver');
const { generateSite, renderPreview, slugify, OUTPUT_DIR } = require('./src/generator');
const { PROFESSIONS } = require('./src/data/professions');
const { isConfigured: isImageSearchConfigured, searchImageOptions } = require('./src/images');
const { addBooking, listBookings } = require('./src/bookings');
const { sendBookingConfirmation } = require('./src/mailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Prototyp-Login fürs Testen des Buchungssystems (siehe README). Nur im
// Speicher des Builder-Servers relevant, keine echte Nutzerverwaltung.
const ADMIN_CREDENTIALS = { identifier: 'admin', password: 'admin' };

// Großzügiges Limit: hochgeladene Bilder werden als Data-URI im JSON-Body
// mitgeschickt (Base64 + mehrere Bild-Slots können mehrere MB ausmachen).
app.use(express.json({ limit: '50mb' }));
app.use(session({
  secret: 'website-builder-local-dev-only',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 4 }, // 4 Stunden
}));
app.use(express.static(path.join(__dirname, 'public')));
// Generierte Websites lokal ansehbar machen: http://localhost:3000/sites/<slug>/index.html
app.use('/sites', express.static(OUTPUT_DIR));

app.get('/professions', (req, res) => {
  res.json({
    professions: PROFESSIONS.map(({ key, label }) => ({ key, label })),
    imagesEnabled: isImageSearchConfigured(),
  });
});

// Bild-Picker im Builder: liefert bis zu 10 Kandidatenfotos zu einem
// Suchbegriff, damit man statt der automatischen Auswahl gezielt ein Bild
// je Seite/Team-Mitglied auswählen kann.
app.get('/images/search', async (req, res) => {
  try {
    const query = String(req.query.query || '').trim();
    if (!query) {
      return res.json({ results: [], imagesEnabled: isImageSearchConfigured() });
    }
    const orientation = String(req.query.orientation || 'landscape');
    const page = parseInt(req.query.page, 10) || 1;
    const results = await searchImageOptions(query, 10, orientation, page);
    res.json({ results, imagesEnabled: isImageSearchConfigured() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bildersuche fehlgeschlagen.', details: err.message });
  }
});

// --- Login + Buchungssystem (Prototyp, siehe README) ---------------------
// Läuft nur hier im Builder-Server, In-Memory-Speicher (Reset bei Neustart).
// Die generierten Seiten (templates/pages/buchungen.hbs) rufen diese
// Endpunkte per fetch() relativ auf – funktioniert beim Testen über
// "Im Browser öffnen" (gleicher Origin), nicht auf extern hochgeladenen
// rein statischen Exporten.

app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (identifier === ADMIN_CREDENTIALS.identifier && password === ADMIN_CREDENTIALS.password) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Benutzername/E-Mail oder Passwort falsch.' });
});

app.post('/api/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

app.post('/api/bookings', async (req, res) => {
  const { name, email, date, time, note } = req.body || {};
  if (!name || !email || !date || !time) {
    return res.status(400).json({ error: 'Name, E-Mail, Datum und Uhrzeit sind erforderlich.' });
  }

  const booking = addBooking({ name, email, date, time, note });

  try {
    const previewUrl = await sendBookingConfirmation(booking);
    res.json({ ok: true, booking, previewUrl });
  } catch (err) {
    // Buchung ist trotzdem erfolgreich – nur die Bestätigungsmail hat nicht geklappt.
    console.error('Terminbestätigung konnte nicht gesendet werden:', err.message);
    res.json({ ok: true, booking, previewUrl: null });
  }
});

app.get('/api/bookings', (req, res) => {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  res.json({ bookings: listBookings() });
});

app.post('/preview', async (req, res) => {
  try {
    const preview = await renderPreview(req.body || {});
    res.json(preview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Vorschau konnte nicht erzeugt werden.', details: err.message });
  }
});

app.post('/open', async (req, res) => {
  try {
    const { slug } = await generateSite(req.body || {});
    res.json({ url: `/sites/${slug}/index.html` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Website konnte nicht geöffnet werden.', details: err.message });
  }
});

app.post('/generate', async (req, res) => {
  try {
    const { slug, siteDir } = await generateSite(req.body || {});

    const downloadName = `${slugify((req.body.business && req.body.business.name) || slug)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error(err);
      res.status(500).end();
    });
    archive.pipe(res);
    archive.directory(siteDir, false);
    archive.finalize();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Website konnte nicht generiert werden.', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Website Builder läuft auf http://localhost:${PORT}`);
});
