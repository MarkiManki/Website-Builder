const path = require('path');
const express = require('express');
const archiver = require('archiver');
const { generateSite, renderPreview, slugify } = require('./src/generator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/preview', (req, res) => {
  try {
    const preview = renderPreview(req.body || {});
    res.json(preview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Vorschau konnte nicht erzeugt werden.', details: err.message });
  }
});

app.post('/generate', (req, res) => {
  try {
    const { slug, siteDir } = generateSite(req.body || {});

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
