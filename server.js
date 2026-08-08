require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const archiver = require('archiver');
const { generateSite, renderPreview, slugify, OUTPUT_DIR } = require('./src/generator');
const { PROFESSIONS } = require('./src/data/professions');
const { isConfigured: isImageSearchConfigured, searchImageOptions } = require('./src/images');
const { addBooking, listBookings, getBooking, setBookingStatus, isSlotTaken, listBookingsForDate } = require('./src/bookings');
const { sendRequestReceived, sendBookingConfirmed, sendBookingDeclined } = require('./src/mailer');
const settingsStore = require('./src/settings');
const servicesStore = require('./src/services');

const app = express();
const PORT = process.env.PORT || 3000;

// Prototyp-Login fürs Testen des Buchungssystems (siehe README). Nur im
// Speicher des Builder-Servers relevant, keine echte Nutzerverwaltung.
const ADMIN_CREDENTIALS = { identifier: 'admin', password: 'admin' };

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  next();
}

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

// Öffentliche Buchung: legt eine ANFRAGE an (status "pending"), noch keine
// Zusage. Lehnt ab, wenn der Slot schon vergeben ist (pending oder confirmed).
app.post('/api/bookings', async (req, res) => {
  const { name, email, date, time, note, skipEmail, status } = req.body || {};
  if (!name || !email || !date || !time) {
    return res.status(400).json({ error: 'Name, E-Mail, Datum und Uhrzeit sind erforderlich.' });
  }
  if (isSlotTaken(date, time)) {
    return res.status(409).json({ error: 'Dieser Termin ist leider schon vergeben. Bitte eine andere Uhrzeit wählen.' });
  }

  // status wird nur für die Beispieldaten-Demo genutzt (immer mit skipEmail
  // kombiniert) – das echte Buchungsformular legt ausschließlich "pending" an.
  const initialStatus = skipEmail && ['pending', 'confirmed'].includes(status) ? status : 'pending';
  const booking = addBooking({ name, email, date, time, note, status: initialStatus });

  // skipEmail: von den Beispieldaten genutzt, um beim Anlegen mehrerer
  // Demo-Termine nicht jedes Mal eine (Test-)Bestätigungsmail zu erzeugen.
  if (skipEmail) {
    return res.json({ ok: true, booking, previewUrl: null });
  }

  try {
    const previewUrl = await sendRequestReceived(booking);
    res.json({ ok: true, booking, previewUrl });
  } catch (err) {
    // Anfrage ist trotzdem erfolgreich – nur die Eingangsbestätigung hat nicht geklappt.
    console.error('Eingangsbestätigung konnte nicht gesendet werden:', err.message);
    res.json({ ok: true, booking, previewUrl: null });
  }
});

// Admin trägt einen Termin direkt ein (z. B. nach einem Telefonanruf) – geht
// sofort auf "confirmed", E-Mail ist optional (Kunde könnte am Telefon keine
// Adresse genannt haben).
app.post('/api/bookings/admin', requireAdmin, async (req, res) => {
  const { name, email, date, time, note, skipEmail } = req.body || {};
  if (!name || !date || !time) {
    return res.status(400).json({ error: 'Name, Datum und Uhrzeit sind erforderlich.' });
  }
  if (isSlotTaken(date, time)) {
    return res.status(409).json({ error: 'Für diesen Slot besteht bereits ein Termin.' });
  }

  const booking = addBooking({ name, email, date, time, note, status: 'confirmed' });

  if (skipEmail || !email) {
    return res.json({ ok: true, booking, previewUrl: null });
  }

  try {
    const previewUrl = await sendBookingConfirmed(booking);
    res.json({ ok: true, booking, previewUrl });
  } catch (err) {
    console.error('Bestätigungsmail konnte nicht gesendet werden:', err.message);
    res.json({ ok: true, booking, previewUrl: null });
  }
});

app.post('/api/bookings/:id/confirm', requireAdmin, async (req, res) => {
  const booking = setBookingStatus(parseInt(req.params.id, 10), 'confirmed');
  if (!booking) return res.status(404).json({ error: 'Termin nicht gefunden.' });
  try {
    const previewUrl = await sendBookingConfirmed(booking);
    res.json({ ok: true, booking, previewUrl });
  } catch (err) {
    console.error('Bestätigungsmail konnte nicht gesendet werden:', err.message);
    res.json({ ok: true, booking, previewUrl: null });
  }
});

app.post('/api/bookings/:id/decline', requireAdmin, async (req, res) => {
  const booking = setBookingStatus(parseInt(req.params.id, 10), 'declined');
  if (!booking) return res.status(404).json({ error: 'Termin nicht gefunden.' });
  try {
    const previewUrl = await sendBookingDeclined(booking);
    res.json({ ok: true, booking, previewUrl });
  } catch (err) {
    console.error('Absage-Mail konnte nicht gesendet werden:', err.message);
    res.json({ ok: true, booking, previewUrl: null });
  }
});

app.get('/api/bookings', requireAdmin, (req, res) => {
  res.json({ bookings: listBookings() });
});

// Für das öffentliche Buchungsformular: welche Uhrzeiten sind an diesem
// Datum grundsätzlich möglich (Öffnungszeiten) und welche davon sind schon
// vergeben? So kann das Formular bereits belegte Zeiten ausschließen.
app.get('/api/day-info', (req, res) => {
  const date = String(req.query.date || '');
  if (!date) return res.status(400).json({ error: 'Datum erforderlich.' });
  const daySettings = settingsStore.getDaySettings(date);
  const taken = listBookingsForDate(date).map((b) => b.time);
  res.json({ ...daySettings, taken });
});

app.get('/api/settings', (req, res) => {
  res.json({ settings: settingsStore.getSettings() });
});

// Idempotent: übernimmt die im Website-Builder eingestellten Werte nur, wenn
// noch keine Einstellungen bestehen (verhindert, dass jeder Seitenaufruf
// bereits vom Admin geänderte Einstellungen wieder überschreibt).
app.post('/api/settings/seed', (req, res) => {
  const { startHour, endHour, slotInterval } = req.body || {};
  const settings = settingsStore.seedIfEmpty({
    startHour: parseInt(startHour, 10),
    endHour: parseInt(endHour, 10),
    slotInterval: parseInt(slotInterval, 10),
  });
  res.json({ settings });
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const settings = settingsStore.updateSettings(req.body || {});
  res.json({ settings });
});

app.get('/api/services', (req, res) => {
  res.json({ services: servicesStore.listServices() });
});

app.post('/api/services/seed', (req, res) => {
  const { services } = req.body || {};
  const result = servicesStore.seedIfEmpty(Array.isArray(services) ? services : []);
  res.json({ services: result });
});

app.post('/api/services', requireAdmin, (req, res) => {
  const service = servicesStore.addService(req.body || {});
  res.json({ ok: true, service });
});

app.put('/api/services/:id', requireAdmin, (req, res) => {
  const service = servicesStore.updateService(parseInt(req.params.id, 10), req.body || {});
  if (!service) return res.status(404).json({ error: 'Leistung nicht gefunden.' });
  res.json({ ok: true, service });
});

app.delete('/api/services/:id', requireAdmin, (req, res) => {
  const ok = servicesStore.deleteService(parseInt(req.params.id, 10));
  if (!ok) return res.status(404).json({ error: 'Leistung nicht gefunden.' });
  res.json({ ok: true });
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
