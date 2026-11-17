const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('workflow GitHub Pages is at the repository root and publishes app as site root', () => {
  const workflowPath = path.join(root, '.github', 'workflows', 'static.yml');
  assert.ok(fs.existsSync(workflowPath), 'workflow static.yml non trovato nella radice');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /cp -R app\/. _site\//);
  assert.match(workflow, /rm -f _site\/nr94\.json/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});

test('workflow Windows build is in the GitHub-recognized workflow directory', () => {
  const file = path.join(root, '.github', 'workflows', 'windows-build.yml');
  assert.ok(fs.existsSync(file));
  const workflow = fs.readFileSync(file, 'utf8');
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run package:win/);
});
