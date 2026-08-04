const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { DEFAULTS, FONT_PRESETS, PAGE_DEFINITIONS } = require('./data/defaults');
const { PROFESSIONS, GENERIC_FALLBACK } = require('./data/professions');
const { getImages } = require('./images');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function slugify(input) {
  return String(input || 'website')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // Umlaute/Akzente entfernen
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'website';
}

function readTemplate(relativePath) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, relativePath), 'utf8');
}

function registerPartials() {
  Handlebars.registerPartial('header', readTemplate('partials/header.hbs'));
  Handlebars.registerPartial('nav', readTemplate('partials/nav.hbs'));
  Handlebars.registerPartial('footer', readTemplate('partials/footer.hbs'));
}

const PAGE_TEMPLATE_FILES = {
  home: 'pages/home.hbs',
  ueberUns: 'pages/ueber-uns.hbs',
  leistungen: 'pages/leistungen.hbs',
  kontakt: 'pages/kontakt.hbs',
  buchungen: 'pages/buchungen.hbs',
  impressum: 'pages/impressum.hbs',
};

function buildEnabledPages(selectedPages) {
  return PAGE_DEFINITIONS.filter((page) => page.available && selectedPages && selectedPages[page.key]);
}

function buildContext(formData) {
  const business = formData.business || {};
  const content = formData.content || {};

  const selectedPages = { ...(formData.pages || {}) };
  // Pflichtseiten sind immer aktiv, unabhängig davon was das Formular schickt.
  PAGE_DEFINITIONS.filter((p) => p.required).forEach((p) => { selectedPages[p.key] = true; });

  const enabledPages = buildEnabledPages(selectedPages);

  const navLinks = enabledPages.map((page) => ({
    key: page.key,
    href: page.file,
    label: page.label.split(' / ')[0].split(' (')[0],
  }));

  const footerLinks = enabledPages
    .filter((page) => page.key === 'impressum' || page.key === 'kontakt')
    .map((page) => ({ href: page.file, label: page.label.split(' / ')[0].split(' (')[0] }));

  const requestedFontKey = formData.design && formData.design.fontKey;
  const fontPreset = FONT_PRESETS.find((f) => f.key === requestedFontKey)
    || FONT_PRESETS.find((f) => f.key === DEFAULTS.defaultFontKey)
    || FONT_PRESETS[0];

  return {
    design: {
      primaryColor: (formData.design && formData.design.primaryColor) || DEFAULTS.primaryColor,
      radius: DEFAULTS.radius,
      fontHeading: fontPreset.fontHeading,
      fontBody: fontPreset.fontBody,
      googleFontsUrl: fontPreset.googleFontsUrl,
    },
    business,
    content,
    pages: selectedPages,
    navLinks,
    footerLinks,
    currentYear: new Date().getFullYear(),
    encodedAddress: encodeURIComponent(business.address || ''),
    enabledPages,
  };
}

// Sucht passende Symbolbilder (Pexels) für Hero/Über-uns/Leistungen anhand der
// gewählten Branche. Ohne konfigurierten API-Key liefert getImages() leere
// Arrays, sodass images.* einfach null bleibt und die Templates ohne Bilder
// rendern (siehe {{#if images.hero}} in den Seiten-Templates).
async function resolveImages(formData) {
  const professionKey = formData.business && formData.business.profession;
  const profession = professionKey ? PROFESSIONS.find((p) => p.key === professionKey) : null;
  const fallback = GENERIC_FALLBACK;
  const terms = (profession || fallback).searchTerms;
  const label = profession ? profession.label : fallback.label;

  const queries = terms[1] && terms[1] !== terms[0] ? [terms[0], terms[1]] : [terms[0]];

  // 4 feste Plätze (Hero/Über-uns/Leistungen-Panel/CTA) + optional ein Bild
  // pro einzelner Leistung für die Leistungs-Karten. Freitext-Leistungsnamen
  // eignen sich nicht als eigene Pexels-Suche (meist Deutsch), daher wird
  // hier stattdessen aus dem ohnehin branchenpassenden Such-Pool bedient.
  const services = (formData.content && formData.content.leistungen && formData.content.leistungen.services) || [];
  const perQueryCount = Math.max(4, Math.ceil((4 + services.length) / queries.length));

  const results = await Promise.all(queries.map((term) => getImages(term, perQueryCount)));
  const pool = [].concat(...results);

  const withAlt = (image) => (image ? { src: image.src, alt: `${label} – Symbolbild` } : null);

  // Im Builder manuell ausgewählte Bilder (Bild-Picker) haben Vorrang vor der
  // automatischen Pool-Auswahl. Ohne Auswahl bleibt das bisherige Verhalten.
  const chosen = (formData.design && formData.design.images) || {};
  const pick = (key, fallbackImage) => (chosen[key] ? { src: chosen[key], alt: `${label} – Symbolbild` } : fallbackImage);

  return {
    hero: pick('hero', withAlt(pool[0])),
    about: pick('about', withAlt(pool[1] || pool[0])),
    services: pick('services', withAlt(pool[2] || pool[1] || pool[0])),
    cta: pick('cta', withAlt(pool[3] || pool[0])),
    serviceImages: services.map((_, i) => withAlt(pool[4 + i])),
  };
}

// Hängt das per Index zugeordnete Bild direkt an jede Leistung an, damit die
// Templates die Karten mit einem simplen {{#each}}/{{#if this.image}} rendern
// können (kein Index-Lookup über verschachtelte Block-Helper nötig).
function attachServiceImages(context) {
  const leistungen = context.content && context.content.leistungen;
  if (!leistungen || !leistungen.services) return;
  const serviceImages = (context.images && context.images.serviceImages) || [];
  leistungen.services = leistungen.services.map((service, i) => ({ ...service, image: serviceImages[i] || null }));
}

function renderPage(pageKey, context, options = {}) {
  const templateFile = PAGE_TEMPLATE_FILES[pageKey];
  if (!templateFile) return null;

  const pageSource = readTemplate(templateFile);
  const pageHtml = Handlebars.compile(pageSource)(context);

  const layoutSource = readTemplate('layout.hbs');
  const seoTitleBase = context.business.name || 'Website';
  const pageDef = PAGE_DEFINITIONS.find((p) => p.key === pageKey);
  const seoTitle = pageKey === 'home' ? seoTitleBase : `${pageDef.label.split(' / ')[0]} · ${seoTitleBase}`;
  // Aktive Seite in der Navigation markieren (pro Seite neu berechnet, da der
  // Context ansonsten für alle Seiten identisch ist).
  const navLinks = context.navLinks.map((link) => ({ ...link, active: link.key === pageKey }));

  return Handlebars.compile(layoutSource)({
    ...context,
    navLinks,
    body: pageHtml,
    assetPrefix: '',
    seoTitle,
    seoDescription: context.business.tagline || '',
    preview: !!options.preview,
    inlineCss: options.preview ? readTemplate('assets/css/base.css') : null,
    inlineJs: options.preview ? readTemplate('assets/js/site.js') : null,
  });
}

// Rendert alle aktuell ausgewählten Seiten für die Live-Vorschau im Builder:
// CSS wird inline eingebettet (kein Dateisystem im iframe verfügbar) und
// interne Links werden per postMessage an das Eltern-Fenster abgefangen,
// damit man im Vorschau-iframe zwischen den Seiten klicken kann.
async function renderPreview(formData) {
  registerPartials();
  const context = buildContext(formData);
  context.images = await resolveImages(formData);
  attachServiceImages(context);

  const pages = {};
  const pageKeyByFile = {};

  context.enabledPages.forEach((page) => {
    const html = renderPage(page.key, context, { preview: true });
    if (html) {
      pages[page.key] = html;
      pageKeyByFile[page.file] = page.key;
    }
  });

  return {
    pages,
    pageKeyByFile,
    defaultPage: pages.home ? 'home' : Object.keys(pages)[0] || null,
  };
}

async function generateSite(formData) {
  registerPartials();
  const context = buildContext(formData);
  context.images = await resolveImages(formData);
  attachServiceImages(context);

  const slug = `${slugify(formData.business && formData.business.name)}-${Date.now()}`;
  const siteDir = path.join(OUTPUT_DIR, slug);
  const cssDir = path.join(siteDir, 'css');
  const jsDir = path.join(siteDir, 'js');
  fs.mkdirSync(cssDir, { recursive: true });
  fs.mkdirSync(jsDir, { recursive: true });

  context.enabledPages.forEach((page) => {
    const html = renderPage(page.key, context);
    if (html) {
      fs.writeFileSync(path.join(siteDir, page.file), html, 'utf8');
    }
  });

  fs.copyFileSync(path.join(TEMPLATES_DIR, 'assets/css/base.css'), path.join(cssDir, 'base.css'));
  fs.copyFileSync(path.join(TEMPLATES_DIR, 'assets/js/site.js'), path.join(jsDir, 'site.js'));

  return { slug, siteDir };
}

module.exports = { generateSite, renderPreview, slugify, OUTPUT_DIR };
