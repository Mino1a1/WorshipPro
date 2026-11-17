const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { readEasyWorshipDatabase } = require('../electron/easyworship-import.cjs');

test('legge canti e parole dai due database EasyWorship in sola lettura', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsp-ew-'));
  const songsPath = path.join(dir, 'Songs.db');
  const wordsPath = path.join(dir, 'SongWords.db');
  try {
    const s = new DatabaseSync(songsPath);
    s.exec("CREATE TABLE song (title TEXT, author TEXT, copyright TEXT); INSERT INTO song VALUES ('Canto test', 'Autore', 'Copyright');");
    s.close();
    const w = new DatabaseSync(wordsPath);
    w.exec("CREATE TABLE word (song_id INTEGER, label TEXT, words TEXT); INSERT INTO word VALUES (1, 'Verse 1', '{\\\\rtf1 Testo}'); INSERT INTO word VALUES (1, 'Chorus', '{\\\\rtf1 Ritornello}');");
    w.close();
    const result = readEasyWorshipDatabase(songsPath, wordsPath);
    assert.equal(result.totalSongs, 1);
    assert.equal(result.importedCandidates, 1);
    assert.equal(result.songs[0].title, 'Canto test');
    assert.equal(result.songs[0].author, 'Autore');
    assert.match(result.songs[0].words, /Testo/);
    assert.equal(result.songs[0].wordRows.length, 2);
    assert.equal(result.songs[0].wordRows[1].label, 'Chorus');
    // Reader must not modify either source database.
    const check = new DatabaseSync(songsPath, { readOnly: true });
    assert.equal(check.prepare('SELECT COUNT(*) AS n FROM song').get().n, 1);
    check.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rifiuta nomi database non previsti', () => {
  assert.throws(() => readEasyWorshipDatabase('/tmp/not-songs.db', '/tmp/SongWords.db'), /Songs\.db/);
});
