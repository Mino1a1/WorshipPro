const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app/app.js'),'utf8');
test('PDF parser source contains common section labels and chord stripping rules',()=>{
  assert.match(source,/function parsePdfSong/);
  assert.match(source,/PRE-CHORUS/);
  assert.match(source,/INSTRUMENTAL/);
  assert.match(source,/isChordOnlyLine/);
  assert.match(source,/function normalizePdfLines/);
});
