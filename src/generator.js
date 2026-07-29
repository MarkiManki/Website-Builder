const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { VARIANT_DEFAULTS, PAGE_DEFINITIONS } = require('./data/defaults');

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
  impressum: 'pages/impressum.hbs',
};

function buildEnabledPages(selectedPages) {
  return PAGE_DEFINITIONS.filter((page) => page.available && selectedPages && selectedPages[page.key]);
}

function buildContext(formData) {
  const type = formData.type === 'unternehmen' ? 'unternehmen' : 'freelancer';
  const variantDefaults = VARIANT_DEFAULTS[type];
  const business = formData.business || {};
  const content = formData.content || {};

  const selectedPages = { ...(formData.pages || {}) };
  // Pflichtseiten sind immer aktiv, unabhängig davon was das Formular schickt.
  PAGE_DEFINITIONS.filter((p) => p.required).forEach((p) => { selectedPages[p.key] = true; });

  const enabledPages = buildEnabledPages(selectedPages);

  const navLinks = enabledPages.map((page) => ({
    href: page.file,
    label: page.label.split(' / ')[0].split(' (')[0],
  }));

  const footerLinks = enabledPages
    .filter((page) => page.key === 'impressum' || page.key === 'kontakt')
    .map((page) => ({ href: page.file, label: page.label.split(' / ')[0].split(' (')[0] }));

  return {
    type,
    design: {
      primaryColor: (formData.design && formData.design.primaryColor) || variantDefaults.primaryColor,
      radius: variantDefaults.radius,
      fontHeading: variantDefaults.fontHeading,
      fontBody: variantDefaults.fontBody,
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

function renderPage(pageKey, context) {
  const templateFile = PAGE_TEMPLATE_FILES[pageKey];
  if (!templateFile) return null;

  const pageSource = readTemplate(templateFile);
  const pageHtml = Handlebars.compile(pageSource)(context);

  const layoutSource = readTemplate('layout.hbs');
  const seoTitleBase = context.business.name || 'Website';
  const pageDef = PAGE_DEFINITIONS.find((p) => p.key === pageKey);
  const seoTitle = pageKey === 'home' ? seoTitleBase : `${pageDef.label.split(' / ')[0]} · ${seoTitleBase}`;

  return Handlebars.compile(layoutSource)({
    ...context,
    body: pageHtml,
    assetPrefix: '',
    seoTitle,
    seoDescription: context.business.tagline || '',
  });
}

function generateSite(formData) {
  registerPartials();
  const context = buildContext(formData);

  const slug = `${slugify(formData.business && formData.business.name)}-${Date.now()}`;
  const siteDir = path.join(OUTPUT_DIR, slug);
  const cssDir = path.join(siteDir, 'css');
  fs.mkdirSync(cssDir, { recursive: true });

  context.enabledPages.forEach((page) => {
    const html = renderPage(page.key, context);
    if (html) {
      fs.writeFileSync(path.join(siteDir, page.file), html, 'utf8');
    }
  });

  fs.copyFileSync(path.join(TEMPLATES_DIR, 'assets/css/base.css'), path.join(cssDir, 'base.css'));

  return { slug, siteDir };
}

module.exports = { generateSite, slugify, OUTPUT_DIR };
