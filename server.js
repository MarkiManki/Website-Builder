require('dotenv').config();
const path = require('path');
const express = require('express');
const archiver = require('archiver');
const { generateSite, renderPreview, slugify, OUTPUT_DIR } = require('./src/generator');
const { PROFESSIONS } = require('./src/data/professions');
const { isConfigured: isImageSearchConfigured } = require('./src/images');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Generierte Websites lokal ansehbar machen: http://localhost:3000/sites/<slug>/index.html
app.use('/sites', express.static(OUTPUT_DIR));

app.get('/professions', (req, res) => {
  res.json({
    professions: PROFESSIONS.map(({ key, label, category }) => ({ key, label, category })),
    imagesEnabled: isImageSearchConfigured(),
  });
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
