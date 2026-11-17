const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/styles.css'), 'utf8');

test('barra menu professionale espone i cinque menu richiesti', () => {
  for (const label of ['File', 'Modifica', 'Vista', 'Impostazioni', 'Strumenti']) assert.match(html, new RegExp(`<summary>${label}</summary>`));
});

test('modalita chiara/scura viene applicata e salvata nelle impostazioni locali', () => {
  assert.match(js, /function applyAppearance\(mode\)/);
  assert.match(js, /key: 'appearanceMode', value: appearanceMode/);
  assert.match(js, /applyAppearance\(settings\.appearanceMode\|\|'dark'\)/);
  assert.match(css, /\[data-theme="light"\]/);
});

test('vista parole e comando LIVE per singola slide sono disponibili', () => {
  assert.match(js, /function renderWordsView\(song\)/);
  assert.match(js, /case 'toggle-words-view'/);
  assert.match(js, /case 'words-live'/);
});

test('logo predefinito viene persistito e usato dal comando logo', () => {
  assert.match(js, /key:'defaultLogoId',value:id/);
  assert.match(js, /assetById\(settings\.defaultLogoId\)/);
  assert.match(js, /case 'set-default-logo'/);
});
