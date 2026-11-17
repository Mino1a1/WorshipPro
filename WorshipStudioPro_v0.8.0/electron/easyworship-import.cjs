const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function readEasyWorshipDatabase(songsDbPath, songWordsDbPath) {
  for (const p of [songsDbPath, songWordsDbPath]) {
    if (typeof p !== 'string' || !path.isAbsolute(p)) throw new Error('Percorso database EasyWorship non valido.');
  }
  if (path.basename(songsDbPath).toLowerCase() !== 'songs.db' || path.basename(songWordsDbPath).toLowerCase() !== 'songwords.db') {
    throw new Error('Seleziona i file Songs.db e SongWords.db originali del profilo EasyWorship.');
  }
  const songsDb = new DatabaseSync(songsDbPath, { readOnly: true });
  let wordsDb;
  try {
    wordsDb = new DatabaseSync(songWordsDbPath, { readOnly: true });
    const tables = db => db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x => String(x.name).toLowerCase());
    const songTables = tables(songsDb), wordTables = tables(wordsDb);
    if (!songTables.includes('song') || !wordTables.includes('word')) throw new Error('Schema EasyWorship non riconosciuto: servono le tabelle song e word.');
    const songCols = songsDb.prepare('PRAGMA table_info(song)').all().map(x => String(x.name));
    const wordCols = wordsDb.prepare('PRAGMA table_info(word)').all().map(x => String(x.name));
    const pick = (cols, candidates) => cols.find(c => candidates.includes(c.toLowerCase()));
    const titleCol = pick(songCols, ['title','name']);
    const authorCol = pick(songCols, ['author','artist']);
    const copyrightCol = pick(songCols, ['copyright','copyright_info']);
    const wordSongIdCol = pick(wordCols, ['song_id','songid','song']);
    const wordsCol = pick(wordCols, ['words','lyrics','text']);
    const labelCol = pick(wordCols, ['label','section','word_label','slide_label']);
    if (!titleCol || !wordSongIdCol || !wordsCol) throw new Error('Colonne dei database EasyWorship non riconosciute.');
    const songs = songsDb.prepare('SELECT rowid AS __rowid, * FROM song').all();
    const words = wordsDb.prepare('SELECT rowid AS __rowid, * FROM word').all();
    const wordMap = new Map();
    for (const row of words) {
      const key = String(row[wordSongIdCol]);
      if (!wordMap.has(key)) wordMap.set(key, []);
      wordMap.get(key).push({ label: labelCol ? String(row[labelCol] ?? '') : '', words: String(row[wordsCol] ?? '') });
    }
    const result = songs.map(row => {
      const id = row.__rowid;
      const wordRows = wordMap.get(String(id)) || [];
      return { id: String(id), title: String(row[titleCol] ?? ''), author: authorCol ? String(row[authorCol] ?? '') : '', copyright: copyrightCol ? String(row[copyrightCol] ?? '') : '', wordRows, words: wordRows.map(x => x.words).join('\\par\\par ') };
    }).filter(x => x.title.trim() && x.words.trim());
    return { songs: result, totalSongs: songs.length, importedCandidates: result.length };
  } finally {
    songsDb.close();
    if (wordsDb) wordsDb.close();
  }
}
module.exports = { readEasyWorshipDatabase };
