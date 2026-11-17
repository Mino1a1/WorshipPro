const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'app');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const output = fs.readFileSync(path.join(root, 'output.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('GitHub Pages app uses relative CSS and JavaScript assets', () => {
  assert.match(index, /href="\.\/styles\.css"/);
  assert.match(index, /src="\.\/app\.js"/);
  assert.match(output, /href="\.\/styles\.css"/);
  assert.match(output, /src="\.\/output\.js"/);
});

test('GitHub Pages output and optional Bible resolve relative to the project path', () => {
  assert.match(js, /new URL\('\.\/output\.html', window\.location\.href\)\.toString\(\)/);
  assert.match(js, /fetch\(new URL\('\.\/nr94\.json', window\.location\.href\)/);
  // Guard against the old root-domain URL which broke project pages under /WorshipPro/.
  assert.doesNotMatch(js, /location\.origin\s*\+\s*['"]\/output\.html/);
});
