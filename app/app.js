'use strict';

const DB_NAME = 'WorshipStudioProLocal';
const DB_VERSION = 1;
const CHANNEL_NAME = 'wsp-live-output-v1';
const channel = ('BroadcastChannel' in window) ? new BroadcastChannel(CHANNEL_NAME) : null;
const $ = id => document.getElementById(id);
const uid = prefix => `${prefix || 'id'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtBytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n/1024).toFixed(1)} KB` : n < 1073741824 ? `${(n/1048576).toFixed(1)} MB` : `${(n/1073741824).toFixed(2)} GB`;
const systemFonts = ['Arial','Arial Black','Aptos','Calibri','Cambria','Candara','Comic Sans MS','Consolas','Courier New','Georgia','Garamond','Impact','Lucida Console','Palatino Linotype','Segoe UI','Tahoma','Times New Roman','Trebuchet MS','Verdana','system-ui','serif','sans-serif'];
const BIBLE_BOOKS = ['Genesi','Esodo','Levitico','Numeri','Deuteronomio','Giosuè','Giudici','Rut','1 Samuele','2 Samuele','1 Re','2 Re','1 Cronache','2 Cronache','Esdra','Neemia','Ester','Giobbe','Salmi','Proverbi','Ecclesiaste','Cantico dei Cantici','Isaia','Geremia','Lamentazioni','Ezechiele','Daniele','Osea','Gioele','Amos','Abdia','Giona','Michea','Naum','Abacuc','Sofonia','Aggeo','Zaccaria','Malachia','Matteo','Marco','Luca','Giovanni','Atti','Romani','1 Corinzi','2 Corinzi','Galati','Efesini','Filippesi','Colossesi','1 Tessalonicesi','2 Tessalonicesi','1 Timoteo','2 Timoteo','Tito','Filemone','Ebrei','Giacomo','1 Pietro','2 Pietro','1 Giovanni','2 Giovanni','3 Giovanni','Giuda','Apocalisse'];
const BUNDLED_BIBLE_TRANSLATION = 'Nuova Riveduta (edizione non indicata nel PDB)';

let db;
let songs = [], services = [], assets = [], themes = [], bibleVerses = [], settings = {};
let activeTab = 'regia';
let activeServiceId = null;
let selectedSongId = null;
let selectedSlideIndex = 0;
let selectedMediaId = null;
let selectedThemeId = 'theme-default';
let liveMode = 'idle';
let livePayload = null;
let displayInfo = { displays: [], outputUrl: new URL('./output.html', window.location.href).toString() };
let obsClient = null;
let obsConnected = false;
let inlineEdit = false;
let wordsView = false;
let appearanceMode = 'dark';
let objectUrls = new Map();
let customFontFaces = [];
let saveTimer;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const d = request.result;
      if (!d.objectStoreNames.contains('songs')) d.createObjectStore('songs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('services')) d.createObjectStore('services', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('themes')) d.createObjectStore('themes', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('bibleVerses')) {
        const store = d.createObjectStore('bibleVerses', { keyPath: 'id' });
        store.createIndex('translation', 'translation', { unique: false });
        store.createIndex('book', 'book', { unique: false });
      }
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function dbRequest(storeName, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let request;
    try { request = action(store); } catch (e) { reject(e); return; }
    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } else {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }
  });
}
const dbGetAll = name => dbRequest(name, 'readonly', s => s.getAll());
const dbPut = (name, value) => dbRequest(name, 'readwrite', s => s.put(value));
const dbDelete = (name, key) => dbRequest(name, 'readwrite', s => s.delete(key));
const dbClear = name => dbRequest(name, 'readwrite', s => s.clear());
const dbGet = (name, key) => dbRequest(name, 'readonly', s => s.get(key));

function defaultTheme() {
  return {
    id: 'theme-default', name: 'Midnight Worship',
    style: { backgroundColor:'#111827', bgMediaId:null, overlay:22, fontFamily:'Arial', fontSize:38, fontWeight:700, color:'#ffffff', align:'center', position:'center', lineHeight:1.35, letterSpacing:0, shadow:true }
  };
}
async function seedDatabase() {
  const existingSongs = await dbGetAll('songs');
  if (!existingSongs.length) {
    const seed = [
      { id:'song-sample-1', title:'Quanto sei grande', author:'Worship Team', key:'G', themeId:'theme-default', slides:[
        {id:uid('slide'), text:'Quanto sei grande, Signor\nDegno di gloria e onore'},
        {id:uid('slide'), text:'La terra canta la Tua fedeltà\nI cieli narrano la Tua maestà'},
        {id:uid('slide'), text:'Santo, santo, santo\nÈ il Signore Dio Onnipotente'}
      ]},
      { id:'song-sample-2', title:'Degno è l’Agnello', author:'Worship Team', key:'A', themeId:'theme-default', slides:[
        {id:uid('slide'), text:'Degno è l’Agnello\nChe è stato immolato'},
        {id:uid('slide'), text:'Onore e potenza\nSiano a Lui per sempre'}
      ]}
    ];
    for (const song of seed) await dbPut('songs', song);
  }
  if (!(await dbGetAll('themes')).length) await dbPut('themes', defaultTheme());
  if (!(await dbGetAll('services')).length) {
    const list = await dbGetAll('songs');
    for (const song of list) await dbPut('services', {id:uid('service'), type:'song', songId:song.id, title:song.title, order:Date.now()+Math.random()});
  }
  if (!(await dbGet('settings','serviceName'))) await dbPut('settings',{key:'serviceName',value:'Celebrazione principale'});
  if (!(await dbGet('settings','activeThemeId'))) await dbPut('settings',{key:'activeThemeId',value:'theme-default'});
}
async function loadData() {
  [songs, services, assets, themes, bibleVerses] = await Promise.all([
    dbGetAll('songs'), dbGetAll('services'), dbGetAll('media'), dbGetAll('themes'), dbGetAll('bibleVerses')
  ]);
  // Prima installazione: importa una sola volta la traduzione fornita dall'utente.
  if (!bibleVerses.some(v => v.translation === BUNDLED_BIBLE_TRANSLATION)) {
    try {
      const response = await fetch(new URL('./nr94.json', window.location.href), { cache: 'no-store' });
      if (response.ok) {
        const bundledRows = await response.json();
        const tx = db.transaction('bibleVerses', 'readwrite');
        const store = tx.objectStore('bibleVerses');
        for (const row of bundledRows) {
          const verse = normalizeVerse(row, BUNDLED_BIBLE_TRANSLATION);
          if (verse) store.put(verse);
        }
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        bibleVerses = await dbGetAll('bibleVerses');
      }
    } catch (error) { console.warn('Caricamento Bibbia locale non riuscito:', error); }
  }
  songs.sort((a,b)=>a.title.localeCompare(b.title,'it'));
  services.sort((a,b)=>(a.order||0)-(b.order||0));
  assets.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const themeSetting = await dbGet('settings','activeThemeId');
  selectedThemeId = themeSetting?.value || themes[0]?.id || 'theme-default';
  if (!selectedSongId && songs[0]) selectedSongId = songs[0].id;
  if (!activeServiceId && services[0]) activeServiceId = services[0].id;
  if (activeServiceId && !services.some(x=>x.id===activeServiceId)) activeServiceId=services[0]?.id||null;
  await loadCustomFonts();
}
function toast(message, isError=false) {
  const t=$('toast'); t.textContent=message; t.style.borderColor=isError?'#a84d60':'#576176'; t.classList.add('show');
  clearTimeout(toast._timer); toast._timer=setTimeout(()=>t.classList.remove('show'),3400);
}
function markSaved() {
  $('saveIndicator').textContent='● Salvato nel database locale';
  $('saveIndicator').style.color='var(--green)';
  clearTimeout(saveTimer); saveTimer=setTimeout(()=>{$('saveIndicator').textContent='● Database locale pronto';},2500);
}
function currentService() { return services.find(s=>s.id===activeServiceId) || null; }
function currentSong() {
  if (activeTab==='canti') return songs.find(s=>s.id===selectedSongId) || null;
  const service=currentService();
  if (service?.type==='song') return songs.find(s=>s.id===service.songId) || null;
  return songs.find(s=>s.id===selectedSongId) || null;
}
function currentSlide() { const song=currentSong(); return song?.slides?.[selectedSlideIndex] || null; }
function currentTheme() {
  const song=currentSong();
  const id=song?.themeId || selectedThemeId;
  return themes.find(t=>t.id===id) || themes[0] || defaultTheme();
}
function currentContent() {
  if (activeTab==='media' && selectedMediaId) { const asset=assetById(selectedMediaId); if(asset) return {kind:'media',mediaId:asset.id,title:asset.name}; }
  if (activeTab==='canti' && selectedSongId) { const song=songs.find(s=>s.id===selectedSongId); const slide=song?.slides?.[selectedSlideIndex]; return {kind:'text',text:slide?.text||'',reference:song?.title||''}; }
  const service=currentService();
  if (!service) return {kind:'text', text:'Benvenuti', reference:''};
  if (service.type==='media') return {kind:'media', mediaId:service.mediaId, title:service.title};
  if (service.type==='scripture' || service.type==='text') return {kind:'text', text:service.text || '', reference:service.reference || service.title};
  if (service.type==='song') {
    const song=songs.find(x=>x.id===service.songId);
    const slide=song?.slides?.[selectedSlideIndex];
    return {kind:'text', text:slide?.text || '', reference:song?.title || service.title};
  }
  return {kind:'text',text:service.text||service.title||'',reference:service.title};
}
function buildPayload(mode='normal') {
  const content=currentContent();
  const theme=currentTheme();
  const formatting=currentSlide()?.importFormatting||{};
  const style={...(theme.style||{})};
  if(formatting.font)style.fontFamily=formatting.font;
  if(formatting.fontSize)style.fontSize=formatting.fontSize;
  if(formatting.color)style.color=formatting.color;
  if(formatting.bold!==undefined)style.fontWeight=formatting.bold?700:400;
  if(formatting.italic!==undefined)style.fontStyle=formatting.italic?'italic':'normal';
  if(formatting.underline!==undefined)style.textDecoration=formatting.underline?'underline':'none';
  return {mode, content, style:JSON.parse(JSON.stringify(style)), themeName:theme.name||'', updatedAt:Date.now()};
}
function broadcastLive() {
  const payload=livePayload || {mode:'idle',updatedAt:Date.now()};
  if (channel) channel.postMessage({type:'LIVE_STATE', state: payload});
  // The local HTTP endpoint also serves OBS Browser Sources, which may run in a separate Chromium profile.
  fetch('/api/live-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'}).catch(()=>{});
}
function setLive(mode) {
  liveMode=mode;
  livePayload=mode==='normal' ? buildPayload('normal') : {mode, updatedAt:Date.now()};
  broadcastLive(); renderLivePanel();
}
function updateLiveIfOnAir() { if (liveMode==='normal') setLive('normal'); }
function assetById(id) { return assets.find(a=>a.id===id); }
async function assetUrl(asset) {
  if (!asset) return null;
  // Desktop app streams from the local media vault; browser preview uses the IndexedDB Blob.
  if (window.wspDesktop) return `/api/media/${encodeURIComponent(asset.id)}`;
  if (!asset.blob) return null;
  if (objectUrls.has(asset.id)) return objectUrls.get(asset.id);
  const url=URL.createObjectURL(asset.blob); objectUrls.set(asset.id,url); return url;
}
async function loadCustomFonts() {
  for (const face of customFontFaces) { try { document.fonts.delete(face); } catch {} }
  customFontFaces=[];
  for (const asset of assets.filter(a=>a.kind==='font')) {
    try {
      const family=asset.fontFamily || asset.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ');
      const url=await assetUrl(asset);
      const face=new FontFace(family,`url(${url})`);
      await face.load(); document.fonts.add(face); customFontFaces.push(face); asset.fontFamily=family;
    } catch (e) { console.warn('Font non caricabile',asset.name,e); }
  }
}
function fontOptions(selected) {
  const fonts=[...systemFonts,...assets.filter(a=>a.kind==='font').map(a=>a.fontFamily||a.name.replace(/\.[^.]+$/,''))];
  return [...new Set(fonts)].map(font=>`<option value="${escapeHTML(font)}" ${font===selected?'selected':''}>${escapeHTML(font)}</option>`).join('');
}
function themeListOptions(selected) { return themes.map(t=>`<option value="${escapeHTML(t.id)}" ${t.id===selected?'selected':''}>${escapeHTML(t.name)}</option>`).join(''); }
function mediaSelectOptions(selected) {
  return `<option value="">Nessuno (solo colore)</option>` + assets.filter(a=>a.kind==='image'||a.kind==='video').map(a=>`<option value="${escapeHTML(a.id)}" ${a.id===selected?'selected':''}>${escapeHTML(a.name)} · ${a.kind==='image'?'Immagine':'Video'}</option>`).join('');
}
function updateFooter() {
  const size=assets.reduce((n,a)=>n+(a.size||0),0);
  $('footerStats').textContent=`${songs.length} canti · ${assets.filter(a=>a.kind!=='font').length} media · ${bibleVerses.length.toLocaleString('it-IT')} versetti · ${fmtBytes(size)}`;
  $('mediaCount').textContent=String(assets.filter(a=>a.kind!=='font').length);
}

function renderLeft() {
  const el=$('leftContent'); let html='';
  if (activeTab==='regia') {
    html='<div class="list-group-title">ORDINE DEL SERVIZIO</div>';
    html+=services.map((s,i)=>`<button class="list-row ${s.id===activeServiceId?'active':''}" data-action="select-service" data-id="${escapeHTML(s.id)}"><span class="row-icon">${s.type==='song'?'♫':s.type==='scripture'?'▤':s.type==='text'?'T':'▧'}</span><span class="row-main"><b>${escapeHTML(s.title)}</b><small>${s.type==='song'?'Canto':s.type==='scripture'?'Bibbia':s.type==='text'?'Testo libero':'Media'}</small></span><span class="count">${String(i+1).padStart(2,'0')}</span></button>`).join('');
    html+='<button class="add-row" data-action="add-service">＋ Aggiungi contenuto alla scaletta</button>';
  } else if (activeTab==='canti') {
    html='<div class="list-group-title">ARCHIVIO CANTI</div>';
    html+=`<div class="field"><input id="songFilter" placeholder="Cerca un canto…"></div>`;
    html+='<div id="songList">'+songs.map(s=>`<button class="list-row ${s.id===selectedSongId?'active':''}" data-action="select-song" data-id="${escapeHTML(s.id)}"><span class="row-icon">♫</span><span class="row-main"><b>${escapeHTML(s.title)}</b><small>${escapeHTML(s.author||'Autore non indicato')}</small></span><span class="count">${s.slides?.length||0}</span></button>`).join('')+'</div>';
    html+='<button class="add-row" data-action="new-song">＋ Crea nuovo canto</button>';
  } else if (activeTab==='bibbia') {
    html='<div class="list-group-title">LIBRI DELLA BIBBIA</div>';
    html+=BIBLE_BOOKS.map(b=>`<button class="list-row" data-action="bible-book" data-book="${escapeHTML(b)}"><span class="row-icon">▤</span><span class="row-main"><b>${escapeHTML(b)}</b></span></button>`).join('');
  } else if (activeTab==='media') {
    html='<div class="list-group-title">LIBRERIA MULTIMEDIALE</div>';
    html+=`<button class="add-row" data-action="import-media">＋ Importa immagini / video / audio</button>`;
    html+=assets.filter(a=>a.kind!=='font').map(a=>`<button class="list-row ${a.id===selectedMediaId?'active':''}" data-action="select-media" data-id="${escapeHTML(a.id)}"><span class="row-icon">${a.kind==='image'?'▧':a.kind==='video'?'▶':'♫'}</span><span class="row-main"><b>${escapeHTML(a.name)}</b><small>${a.kind.toUpperCase()} · ${fmtBytes(a.size||0)}</small></span></button>`).join('');
  } else if (activeTab==='temi') {
    html='<div class="list-group-title">TEMI GRAFICI</div>';
    html+=themes.map(t=>`<button class="list-row ${t.id===currentTheme().id?'active':''}" data-action="select-theme" data-id="${escapeHTML(t.id)}"><span class="row-icon">◈</span><span class="row-main"><b>${escapeHTML(t.name)}</b><small>${escapeHTML(t.style?.fontFamily||'Arial')}</small></span></button>`).join('');
    html+='<button class="add-row" data-action="new-theme">＋ Crea nuovo tema</button><button class="add-row" data-action="import-fonts">＋ Importa font locali</button>';
  } else if (activeTab==='database') {
    html='<div class="list-group-title">GESTIONE ARCHIVIO</div>';
    html+='<button class="list-row active"><span class="row-icon">▥</span><span class="row-main"><b>Database locale</b><small>IndexedDB sul computer</small></span></button>';
    html+='<button class="list-row" data-action="import-bible"><span class="row-icon">▤</span><span class="row-main"><b>Importa Bibbia</b><small>JSON, CSV o TXT autorizzato</small></span></button>';
    html+='<button class="list-row" data-action="backup-export"><span class="row-icon">⇩</span><span class="row-main"><b>Esporta backup</b><small>Contenuti e media</small></span></button>';
    html+='<button class="list-row" data-action="backup-import"><span class="row-icon">⇧</span><span class="row-main"><b>Ripristina backup</b><small>File .wspbackup</small></span></button>';
  } else if (activeTab==='connessioni') {
    html='<div class="list-group-title">DISPLAY DISPONIBILI</div>';
    html+=displayInfo.displays.map(d=>`<button class="list-row" data-action="open-output" data-id="${d.id}"><span class="row-icon">▣</span><span class="row-main"><b>${escapeHTML(d.name)}</b><small>${d.width} × ${d.height}${d.primary?' · Primario':' · Esterno'}</small></span></button>`).join('');
    if (!displayInfo.displays.length) html+='<div class="empty-state">Rilevamento schermi disponibile nell’app desktop.</div>';
    html+='<button class="add-row" data-action="refresh-displays">↻ Aggiorna schermi</button>';
  }
  el.innerHTML=html;
}
function renderRegiaPanel() {
  const service=currentService();
  if (!service) return `<div class="empty-state"><strong>La scaletta è vuota</strong>Aggiungi un canto, un testo libero, un brano biblico importato oppure un contenuto multimediale.<div class="btn-row"><button class="primary-btn" data-action="new-song">＋ Crea canto</button><button class="secondary-btn" data-action="add-free-text">＋ Testo libero</button><button class="secondary-btn" data-action="import-media">Importa media</button></div></div>`;
  let detail='';
  if(service.type==='song') {
    const song=songs.find(s=>s.id===service.songId);
    detail=`<h3>${escapeHTML(song?.title||service.title)}</h3><p class="section-sub">Canto · ${song?.slides.length||0} slide · Tema: ${escapeHTML(themes.find(t=>t.id===song?.themeId)?.name||currentTheme().name)}</p><div class="slide-list">${(song?.slides||[]).map((sl,i)=>`<div class="slide-row ${i===selectedSlideIndex?'selected':''}"><span class="slide-no">${String(i+1).padStart(2,'0')}</span><span class="slide-text">${escapeHTML(sl.text)}</span><button data-action="select-slide" data-index="${i}" title="Seleziona">Apri</button></div>`).join('')}</div><div class="btn-row"><button class="secondary-btn" data-action="edit-song">Apri editor canto</button><button class="secondary-btn" data-action="select-tab" data-tab="temi">Personalizza tema</button></div>`;
  } else if(service.type==='scripture') {
    detail=`<h3>${escapeHTML(service.title)}</h3><p class="section-sub">Versetto importato · ${escapeHTML(service.translation||'Traduzione locale')}</p><div class="field"><label>Testo del brano (modificabile)</label><textarea id="serviceTextEdit">${escapeHTML(service.text||'')}</textarea></div><div class="btn-row"><button class="secondary-btn" data-action="save-service-text">Salva testo</button></div>`;
  } else if(service.type==='text') {
    detail=`<h3>${escapeHTML(service.title)}</h3><p class="section-sub">Testo libero · contenuto personalizzato</p><div class="field"><label>Scrivi il contenuto da proiettare</label><textarea id="serviceTextEdit" rows="6" placeholder="Scrivi qui il testo che vuoi mostrare…">${escapeHTML(service.text||'')}</textarea></div><div class="btn-row"><button class="secondary-btn" data-action="save-service-text">Salva testo</button><button class="secondary-btn" id="previewEditText">Modifica direttamente nell’anteprima</button></div>`;
  } else {
    const asset=assetById(service.mediaId);
    detail=`<h3>${escapeHTML(service.title)}</h3><p class="section-sub">Contenuto multimediale · ${escapeHTML(asset?.name||'File non trovato')}</p><div class="help-text">Il media verrà visualizzato a pieno schermo nell’uscita LIVE. Gestisci il file dalla sezione Media.</div>`;
  }
  return `<div class="form-grid"><div class="field full-span"><label>Elemento selezionato nella scaletta</label><div class="inline-fields"><input id="serviceTitleEdit" value="${escapeHTML(service.title)}"><button class="small-btn" data-action="save-service-title">Rinomina</button></div></div><div class="field full-span">${detail}</div></div><div class="divider"></div><div class="btn-row"><button class="secondary-btn" data-action="move-service-up">↑ Sposta su</button><button class="secondary-btn" data-action="move-service-down">↓ Sposta giù</button><button class="secondary-btn" data-action="add-free-text">＋ Testo libero</button><button class="secondary-btn danger-quiet" data-action="remove-service">Rimuovi dalla scaletta</button></div>`;
}
function applyAppearance(mode) {
  appearanceMode = mode === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = appearanceMode;
  const toggle = $('appearanceToggle');
  if (toggle) toggle.textContent = appearanceMode === 'dark' ? '☼ Chiara' : '☾ Scura';
}
async function toggleAppearance() {
  appearanceMode = appearanceMode === 'dark' ? 'light' : 'dark';
  applyAppearance(appearanceMode);
  settings.appearanceMode = appearanceMode;
  await dbPut('settings', { key: 'appearanceMode', value: appearanceMode });
  markSaved();
}
function renderWordsView(song) {
  const slides = song.slides || [];
  return `<h3>Vista parole · ${escapeHTML(song.title)}</h3><p class="section-sub">Visualizzazione lineare del testo, in stile scaletta editoriale: le parole sono leggibili una dopo l’altra, senza essere limitate a una griglia di riquadri.</p>
  <div class="btn-row"><button class="secondary-btn" data-action="toggle-words-view">Torna all’editor slide</button><button class="secondary-btn" data-action="split-song">Dividi testo in slide</button><button class="primary-btn" data-action="add-slide">＋ Nuova slide</button></div>
  <div class="words-view">${slides.map((sl,i)=>`<article class="words-row ${i===selectedSlideIndex?'active':''}"><span class="words-index">${String(i+1).padStart(2,'0')}</span><div class="words-content"><span class="words-section">${escapeHTML(sl.section||'Slide '+(i+1))}</span>${escapeHTML(sl.text||'Slide vuota')}</div><div class="words-actions"><button class="small-btn" data-action="select-slide" data-index="${i}">Seleziona</button><button class="small-btn" data-action="words-live" data-index="${i}">LIVE</button></div></article>`).join('')}</div>`;
}
function renderCantiPanel() {
  const song=songs.find(s=>s.id===selectedSongId) || songs[0];
  if(!song) return '<div class="empty-state"><strong>Nessun canto</strong>Crea il primo canto per iniziare.</div>';
  if(wordsView) return renderWordsView(song);
  const slide=song.slides[selectedSlideIndex] || song.slides[0];
  return `<h3>Editor canto</h3><p class="section-sub">Modifica titolo, informazioni, sequenza e testo delle slide. Le modifiche vengono salvate nel database locale.</p>
  <div class="btn-row"><button class="secondary-btn" data-action="toggle-words-view">Vista parole</button><button class="primary-btn" data-action="easyworship-import">⇧ Importa da EasyWorship</button><button class="secondary-btn" data-action="easyworship-folder">Importa cartella backup / Resources</button><span class="help-text">Database Songs.db + SongWords.db, RTF/TXT, temi, font e media</span></div>
  <div class="form-grid">
    <div class="field"><label>Titolo del canto</label><input id="songTitle" value="${escapeHTML(song.title)}"></div>
    <div class="field"><label>Autore</label><input id="songAuthor" value="${escapeHTML(song.author||'')}"></div>
    <div class="field"><label>Tonalità</label><input id="songKey" value="${escapeHTML(song.key||'')}" placeholder="Es. G, D, A"></div>
    <div class="field"><label>Tema assegnato</label><select id="songTheme">${themeListOptions(song.themeId||selectedThemeId)}</select></div>
  </div><div class="divider"></div>
  <div class="form-grid"><div class="field full-span"><label>Sequenza delle slide</label><div class="slide-list">${song.slides.map((s,i)=>`<div class="slide-row ${i===selectedSlideIndex?'selected':''}"><span class="slide-no">${String(i+1).padStart(2,'0')}</span><span class="slide-text">${escapeHTML(s.section||'Slide')} · ${escapeHTML(s.text.replace(/\n/g,' '))||'Slide vuota'}</span><button data-action="select-slide" data-index="${i}">Apri</button><button data-action="move-slide-up" data-index="${i}" title="Sposta su">↑</button><button data-action="move-slide-down" data-index="${i}" title="Sposta giù">↓</button></div>`).join('')}</div><div class="btn-row"><button class="secondary-btn" data-action="add-slide">＋ Aggiungi slide</button><button class="secondary-btn" data-action="split-song">Dividi testo in slide</button></div></div>
  <div class="field"><label>Tipo di sezione</label><select id="slideSection"><option value="Intro" ${slide?.section==='Intro'?'selected':''}>Intro</option><option value="Strofa 1" ${!slide?.section||slide?.section==='Strofa 1'?'selected':''}>Strofa 1</option><option value="Strofa 2" ${slide?.section==='Strofa 2'?'selected':''}>Strofa 2</option><option value="Strofa 3" ${slide?.section==='Strofa 3'?'selected':''}>Strofa 3</option><option value="Pre-ritornello" ${slide?.section==='Pre-ritornello'?'selected':''}>Pre-ritornello</option><option value="Ritornello" ${slide?.section==='Ritornello'?'selected':''}>Ritornello</option><option value="Ponte" ${slide?.section==='Ponte'?'selected':''}>Ponte</option><option value="Finale" ${slide?.section==='Finale'?'selected':''}>Finale</option><option value="Altro" ${slide?.section==='Altro'?'selected':''}>Altro</option></select></div><div class="field full-span"><label>Testo della slide ${selectedSlideIndex+1}</label><textarea id="slideContent" rows="4" placeholder="Scrivi qui le parole del canto…">${escapeHTML(slide?.text||'')}</textarea><small>Usa Invio per andare a capo. Per creare più slide incolla un testo e usa “Dividi testo in slide” separando le parti con una riga vuota.</small></div></div>
  <div class="btn-row"><button class="primary-btn" data-action="save-song">Salva canto</button><button class="secondary-btn" data-action="add-song-to-service">Aggiungi alla scaletta</button><button class="secondary-btn" data-action="duplicate-song">Duplica canto</button><button class="secondary-btn danger-quiet" data-action="delete-song">Elimina canto</button></div>`;
}
function renderBiblePanel() {
  const translations=[...new Set(bibleVerses.map(v=>v.translation||'Importata'))];
  const bundledLoaded=bibleVerses.some(v=>v.translation===BUNDLED_BIBLE_TRANSLATION);
  return `<h3>Archivio Bibbia</h3><p class="section-sub">La traduzione contenuta nel file PDB fornito è disponibile localmente, insieme alla ricerca per parola e riferimento. Puoi selezionare libro e capitolo e inviare i versetti alla scaletta.</p>
  ${bundledLoaded?`<div class="help-text" style="margin-bottom:10px">✓ Bibbia caricata: 66 libri · 1.189 capitoli · ${bibleVerses.filter(v=>v.translation===BUNDLED_BIBLE_TRANSLATION).length.toLocaleString('it-IT')} versetti. Il file PDB riporta “Nuova Riveduta”, ma non specifica l'anno dell'edizione: non è quindi possibile certificare da questi metadati che sia la NR94.</div>`:''}
  <div class="form-grid"><div class="field full-span"><label>Ricerca per parola o riferimento</label><input id="bibleQuery" placeholder="Es. amore, Giovanni 3:16, Salmo 23"></div><div class="field"><label>Traduzione</label><select id="bibleTranslation"><option value="">Tutte le traduzioni</option>${translations.map(t=>`<option>${escapeHTML(t)}</option>`).join('')}</select></div><div class="field"><label>Libro</label><select id="bibleBook"><option value="">Tutti i libri</option>${BIBLE_BOOKS.map(b=>`<option>${escapeHTML(b)}</option>`).join('')}</select></div><div class="field"><label>Capitolo</label><select id="bibleChapter" disabled><option value="">Tutti i capitoli</option></select></div></div>
  <div class="btn-row"><button class="primary-btn" data-action="import-bible">＋ Importa Bibbia / traduzione</button><button class="secondary-btn" data-action="bible-format">Formato file supportato</button></div>
  <div class="divider"></div><div class="inline-fields" style="justify-content:space-between"><b style="font-size:10px">Risultati della ricerca</b><span class="help-text">${bibleVerses.length.toLocaleString('it-IT')} versetti nel database</span></div><div class="bible-results" id="bibleResults"><div class="empty-state">${bibleVerses.length?'Scrivi una parola o scegli libro e capitolo.':'Nessuna traduzione importata.'}</div></div>`;
}
function renderMediaPanel() {
  return `<h3>Gestione media locale</h3><p class="section-sub">Importa immagini, fotografie, video e audio. I file vengono copiati nell’archivio media locale e restano disponibili offline.</p>
  <div class="btn-row"><button class="primary-btn" data-action="import-media">＋ Importa file multimediali</button><span class="help-text">Immagini, video e audio · Nessun caricamento cloud</span></div><div class="divider"></div>
  ${assets.filter(a=>a.kind!=='font').length?`<div class="asset-grid">${assets.filter(a=>a.kind!=='font').map(a=>`<div class="asset-card"><div class="asset-thumb" id="asset-thumb-${escapeHTML(a.id)}">${a.kind==='video'?'▶':a.kind==='audio'?'♫':'▧'}</div><b title="${escapeHTML(a.name)}">${escapeHTML(a.name)}</b><small>${a.kind.toUpperCase()} · ${fmtBytes(a.size||0)}</small><div class="asset-actions"><button class="small-btn" data-action="add-media-service" data-id="${escapeHTML(a.id)}">Scaletta</button><button class="small-btn" data-action="set-background" data-id="${escapeHTML(a.id)}">Sfondo</button>${a.kind==='image'?`<button class="small-btn" data-action="set-default-logo" data-id="${escapeHTML(a.id)}">${settings.defaultLogoId===a.id?'Logo ✓':'Imposta logo'}</button>`:''}<button class="small-btn danger-quiet" data-action="delete-media" data-id="${escapeHTML(a.id)}">×</button></div></div>`).join('')}</div>`:`<div class="empty-state"><strong>La libreria è vuota</strong>Importa i tuoi file. Immagini e video potranno essere usati come sfondo dei canti o come contenuto principale in diretta.</div>`}`;
}
function renderThemesPanel() {
  const theme=currentTheme(), style=theme.style||{};
  return `<h3>Editor temi grafici</h3><p class="section-sub">Personalizza sfondo, font, colore, dimensioni, allineamento, posizione e leggibilità del testo. Puoi assegnare un tema diverso a ogni canto.</p>
  <div class="form-grid">
   <div class="field"><label>Nome tema</label><input id="themeName" value="${escapeHTML(theme.name)}"></div><div class="field"><label>Tema attivo</label><select id="themeChoose">${themeListOptions(theme.id)}</select></div>
   <div class="field"><label>Colore sfondo</label><input id="themeBackground" type="color" value="${escapeHTML(style.backgroundColor||'#111827')}"></div><div class="field"><label>Immagine / video di sfondo</label><select id="themeMedia">${mediaSelectOptions(style.bgMediaId)}</select></div>
   <div class="field"><label>Font</label><select id="themeFont">${fontOptions(style.fontFamily||'Arial')}</select></div><div class="field"><label>Dimensione testo (px)</label><input id="themeSize" type="range" min="16" max="110" value="${Number(style.fontSize)||38}"><small id="themeSizeValue">${Number(style.fontSize)||38}px</small></div>
   <div class="field"><label>Colore testo</label><input id="themeColor" type="color" value="${escapeHTML(style.color||'#ffffff')}"></div><div class="field"><label>Peso font</label><select id="themeWeight"><option value="400" ${style.fontWeight==400?'selected':''}>Normale</option><option value="600" ${style.fontWeight==600?'selected':''}>Semibold</option><option value="700" ${style.fontWeight==700?'selected':''}>Grassetto</option><option value="800" ${style.fontWeight==800?'selected':''}>Extra bold</option></select></div>
   <div class="field"><label>Allineamento</label><select id="themeAlign"><option value="left" ${style.align==='left'?'selected':''}>Sinistra</option><option value="center" ${!style.align||style.align==='center'?'selected':''}>Centro</option><option value="right" ${style.align==='right'?'selected':''}>Destra</option></select></div><div class="field"><label>Posizione verticale</label><select id="themePosition"><option value="top" ${style.position==='top'?'selected':''}>In alto</option><option value="center" ${!style.position||style.position==='center'?'selected':''}>Centro</option><option value="bottom" ${style.position==='bottom'?'selected':''}>In basso</option></select></div>
   <div class="field"><label>Oscuramento sfondo</label><input id="themeOverlay" type="range" min="0" max="90" value="${Number(style.overlay)||0}"><small id="themeOverlayValue">${Number(style.overlay)||0}%</small></div><div class="field"><label>Ombra testo</label><select id="themeShadow"><option value="true" ${style.shadow!==false?'selected':''}>Attiva</option><option value="false" ${style.shadow===false?'selected':''}>Disattiva</option></select></div>
   <div class="field"><label>Spaziatura lettere</label><input id="themeLetterSpacing" type="range" min="-1" max="8" step="0.5" value="${Number(style.letterSpacing)||0}"></div><div class="field"><label>Interlinea</label><input id="themeLineHeight" type="range" min="1" max="2" step="0.05" value="${Number(style.lineHeight)||1.35}"><small id="themeLineHeightValue">${Number(style.lineHeight)||1.35}</small></div>
  </div><div class="help-text" style="margin:8px 0">Il testo di proiezione è un livello indipendente e sempre trasparente: immagine o video restano sul livello sottostante, senza riquadro dietro alle parole.</div><div class="btn-row"><button class="primary-btn" data-action="save-theme">Salva tema</button><button class="secondary-btn" data-action="new-theme">Crea tema nuovo</button><button class="secondary-btn" data-action="duplicate-theme">Duplica tema</button><button class="secondary-btn" data-action="import-fonts">Importa font TTF / OTF / WOFF</button><button class="secondary-btn" data-action="remove-theme">Elimina tema</button></div><div class="divider"></div><div class="help-text">Font disponibili: quelli installati nel sistema, più i font locali importati. I font importati vengono conservati nel database e caricati anche nella finestra LIVE.</div>`;
}
function renderDatabasePanel() {
  const mediaBytes=assets.reduce((n,a)=>n+(a.size||0),0);
  const fonts=assets.filter(a=>a.kind==='font').length;
  const translations=[...new Set(bibleVerses.map(v=>v.translation))];
  return `<h3>Database locale Worship Studio Pro</h3><p class="section-sub">Archivio IndexedDB offline-first: i record e i file Blob vengono memorizzati nel profilo locale dell'applicazione.</p>
  <div class="metric-grid"><div class="metric"><b>${songs.length}</b><span>Canti</span></div><div class="metric"><b>${assets.filter(a=>a.kind!=='font').length}</b><span>Media</span></div><div class="metric"><b>${bibleVerses.length.toLocaleString('it-IT')}</b><span>Versetti importati</span></div><div class="metric"><b>${themes.length}</b><span>Temi</span></div></div>
  <div class="divider"></div><div class="form-grid"><div class="field"><label>Spazio media stimato</label><input readonly value="${fmtBytes(mediaBytes)}"></div><div class="field"><label>Font personalizzati</label><input readonly value="${fonts}"></div><div class="field full-span"><label>Traduzioni presenti</label><input readonly value="${escapeHTML(translations.join(', ')||'Nessuna traduzione importata')}"></div></div>
  <div class="btn-row"><button class="primary-btn" data-action="backup-export">⇩ Esporta backup completo</button><button class="secondary-btn" data-action="backup-import">⇧ Ripristina backup</button><button class="secondary-btn" data-action="import-bible">Importa traduzione Bibbia</button><button class="secondary-btn" data-action="db-refresh">↻ Aggiorna statistiche</button></div>
  <div class="divider"></div><h3>Struttura e sicurezza</h3><p class="help-text">Database e archivio media sul dispositivo corrente, senza account cloud. I contenuti possono essere esportati in un file di backup. I video possono occupare molto spazio: tieni una copia di sicurezza su un disco esterno. Il browser o il sistema operativo possono applicare limiti di spazio e chiedere autorizzazione per l’archiviazione persistente.</p>`;
}
function renderConnectionsPanel() {
  const displays=displayInfo.displays||[];
  const url=displayInfo.outputUrl||new URL('./output.html', window.location.href).toString();
  const obsUrl=`${url}${url.includes('?')?'&':'?'}transparent=${settings.obsTransparent?'1':'0'}`;
  return `<h3>Schermi indipendenti e collegamento OBS</h3><p class="section-sub">La stessa uscita LIVE può essere mostrata sul monitor esterno e acquisita da OBS simultaneamente tramite Browser Source locale.</p>
  <div class="form-grid"><div class="field full-span"><label>Monitor rilevati</label><div class="bible-results">${displays.length?displays.map(d=>`<div class="bible-result"><span><b>${escapeHTML(d.name)}</b><br><small>${d.width} × ${d.height} ${d.primary?'· Principale':'· Esterno'}</small></span><button class="small-btn" data-action="open-output" data-id="${d.id}">Apri LIVE</button></div>`).join(''):'<div class="empty-state">Per rilevare più monitor avvia l’app desktop e collega il display prima dell’aggiornamento.</div>'}</div></div>
  <div class="field full-span"><div class="btn-row"><button class="secondary-btn" data-action="refresh-displays">↻ Aggiorna monitor</button><button class="secondary-btn" data-action="close-output">Chiudi finestra LIVE</button><button class="secondary-btn" data-action="toggle-fullscreen">Schermo intero regia</button></div></div>
  <div class="field full-span"><label>URL Browser Source per OBS</label><div class="inline-fields"><input id="outputUrl" readonly value="${escapeHTML(obsUrl)}"><button class="small-btn" data-action="copy-output-url">Copia URL</button></div><label style="display:flex;align-items:center;gap:8px;margin-top:4px"><input id="obsTransparent" type="checkbox" ${settings.obsTransparent?'checked':''} style="width:auto"> Overlay trasparente: invia testi/media in sovrimpressione senza lo sfondo del tema</label><small>Disattivalo per inviare a OBS la slide completa con sfondo. Il monitor esterno mantiene sempre la presentazione completa.</small></div>
  <div class="field"><label>Indirizzo OBS WebSocket</label><input id="obsHost" value="127.0.0.1" placeholder="127.0.0.1"></div><div class="field"><label>Porta</label><input id="obsPort" value="4455" type="number" min="1" max="65535"></div>
  <div class="field full-span"><label>Password WebSocket OBS</label><input id="obsPassword" type="password" autocomplete="off" placeholder="Password configurata in OBS · non viene salvata"></div>
  <div class="field full-span"><div class="btn-row"><button class="primary-btn" data-action="obs-connect">Connetti a OBS</button><button class="secondary-btn" data-action="obs-disconnect">Disconnetti</button><button class="secondary-btn" data-action="obs-create-source">Crea / aggiorna Browser Source in OBS</button></div><div class="obs-status" id="obsStatus">OBS WebSocket non connesso. In OBS Studio abilita Server WebSocket dalle impostazioni Strumenti → WebSocket Server.</div></div></div>
  <div class="divider"></div><p class="help-text">Per sicurezza, proteggi OBS WebSocket con una password. Il server locale di Worship Studio Pro è in ascolto solo su 127.0.0.1 e non espone l’output alla rete. Per la cattura simultanea: apri la finestra LIVE sul secondo schermo e aggiungi lo stesso URL in OBS come Browser Source.</p>`;
}

function renderPdfImportPanel() {
  return `<div class="pdf-layout">
    <div class="pdf-box">
      <div class="eyebrow">PASSAGGIO 1 · ESTRAZIONE</div><h2>Importa uno spartito PDF</h2>
      <p class="help-text">Carica un PDF con testo selezionabile. I PDF scansiti vengono riconosciuti con OCR locale in italiano e inglese. Il testo OCR può contenere errori: controllalo sempre.</p>
      <div class="pdf-toolbar"><button class="primary-btn" data-action="pick-pdf">＋ Seleziona PDF</button><span id="pdfFileName" class="help-text">Nessun file selezionato</span></div>
      <div class="field"><label>Testo estratto (modificabile)</label><textarea id="pdfRawText" placeholder="Il testo del PDF apparirà qui dopo l'estrazione..."></textarea></div>
      <div class="pdf-toolbar"><button class="secondary-btn" data-action="force-pdf-ocr">Forza OCR (italiano + inglese)</button><button class="secondary-btn" data-action="parse-pdf">Analizza struttura e pulisci</button><button class="secondary-btn" data-action="reset-pdf">Azzera</button></div>
      <p class="help-text">Rimozione euristica: accordi tra parentesi o su righe dedicate, capo, BPM, tonalità, numeri pagina, intestazioni ripetute e diciture editoriali. Controlla sempre l'anteprima prima di importare.</p>
    </div>
    <div class="pdf-box">
      <div class="eyebrow">PASSAGGIO 2 · REVISIONE</div><h2>Struttura del brano</h2>
      <div class="field"><label>Titolo del canto</label><input id="pdfSongTitle" placeholder="Titolo riconosciuto o inserisci manualmente"></div>
      <div class="field"><label>Autore (facoltativo)</label><input id="pdfSongAuthor" placeholder="Autore"></div>
      <div class="field"><label>Sezioni riconosciute e testo pulito</label><div id="pdfSections"><div class="empty-state">Carica un PDF e premi “Analizza struttura e pulisci”.</div></div></div>
      <div class="pdf-toolbar"><button class="primary-btn" data-action="import-pdf-song" id="pdfImportButton" disabled>Salva canto nel database</button></div>
    </div>
  </div>`;
}
function renderStreamDeckPanel() {
  const token=streamDeckInfo?.token||'Caricamento token…';
  const base=streamDeckInfo?.baseUrl||location.origin;
  const actions=[['Precedente','previous'],['Successiva','next'],['Invia LIVE','live'],['Clear','clear'],['Schermo nero','black'],['Mostra logo','logo'],['Apri applicazione','open-app']];
  return `<div class="deck-box">
    <div class="eyebrow">CONTROLLO HARDWARE · RETE LOCALE</div><h2>Stream Deck / Bitfocus Companion</h2>
    <p class="help-text">Worship Studio Pro espone comandi HTTP locali autenticati da un token. Puoi richiamarli da Bitfocus Companion tramite Generic HTTP Request e assegnare ogni URL a un tasto fisico. L'app deve essere aperta sul computer della regia.</p>
    <div class="pdf-box"><h3>Profilo rapido VSD Craft</h3><p class="help-note">VSD Craft può inviare macro e scorciatoie da tastiera. Crea i tasti come macro tastiera e usa queste combinazioni mentre Worship Studio Pro è in primo piano:</p><div class="endpoint-list"><b>Precedente</b><code>Ctrl + Alt + ←</code><span>Slide −1</span></div><div class="endpoint-list"><b>Successiva</b><code>Ctrl + Alt + →</code><span>Slide +1</span></div><div class="endpoint-list"><b>LIVE</b><code>Ctrl + Alt + Enter</code><span>Invia LIVE</span></div><div class="endpoint-list"><b>Clear</b><code>Ctrl + Alt + Backspace</code><span>Schermo vuoto</span></div><div class="endpoint-list"><b>Black</b><code>Ctrl + Alt + B</code><span>Schermo nero</span></div><div class="endpoint-list"><b>Logo</b><code>Ctrl + Alt + L</code><span>Mostra logo</span></div><p class="help-note">Per “Apri applicazione”, usa l'azione VSD Craft per avviare Worship Studio Pro o richiamare la finestra già aperta. Queste scorciatoie sono un'integrazione macro, non un plugin nativo VSD.</p></div>
    <div class="field"><label>Indirizzo API locale</label><input readonly value="${escapeHTML(base)}"></div>
    <div class="field"><label>Token di sicurezza (non condividerlo)</label><input readonly id="deckToken" value="${escapeHTML(token)}"></div>
    <div class="pdf-toolbar"><button class="secondary-btn" data-action="copy-deck-token">Copia token</button><button class="secondary-btn" data-action="refresh-deck-info">Aggiorna stato</button></div>
    <div class="deck-actions">${actions.map(([label,action])=>`<div class="deck-action"><b>${label}</b><small>${escapeHTML(`${base}/api/streamdeck/${action}?token=${token}`)}</small></div>`).join('')}</div>
    <h3>Configurazione in Companion</h3>
    <ol class="help-note"><li>Aggiungi il modulo <b>Generic HTTP Request</b>.</li><li>Per ogni tasto scegli una richiesta <b>GET</b>.</li><li>Incolla l'URL corrispondente alla funzione desiderata.</li><li>Usa “Precedente” e “Successiva” per la navigazione; “LIVE”, “Clear” e “Schermo nero” per la regia.</li></ol>
    <p class="help-note">Il comando “Mostra logo” usa l'immagine il cui nome contiene “logo” nell'archivio media; se non esiste mostra una schermata testuale Worship Studio Pro. “Apri applicazione” riporta la finestra di regia in primo piano.</p>
    <p class="help-note"><b>Importante:</b> l'API ascolta solo su 127.0.0.1 e richiede il token. Per controllare il computer da un altro dispositivo, usa Companion sullo stesso computer o configura una rete/VPN sicura: non esporre questa API direttamente a Internet.</p>
  </div>`;
}

function renderMainPanel() {
  const el=$('mainPanel');
  if(activeTab==='regia') el.innerHTML=renderRegiaPanel();
  else if(activeTab==='canti') el.innerHTML=renderCantiPanel();
  else if(activeTab==='bibbia') el.innerHTML=renderBiblePanel();
  else if(activeTab==='media') el.innerHTML=renderMediaPanel();
  else if(activeTab==='temi') el.innerHTML=renderThemesPanel();
  else if(activeTab==='database') el.innerHTML=renderDatabasePanel();
  else el.innerHTML=renderConnectionsPanel();
  if(activeTab==='media') renderAssetThumbs();
  if(activeTab==='bibbia') renderBibleResults();
  if(activeTab==='connessioni') updateObsStatus();
}
function renderAssetThumbs() {
  for(const a of assets.filter(x=>x.kind!=='font')) {
    const el=$(`asset-thumb-${a.id}`); if(!el) continue;
    assetUrl(a).then(url=>{
      if(!el.isConnected) return;
      if(a.kind==='image') el.innerHTML=`<img alt="" src="${url}">`;
      else if(a.kind==='video') el.innerHTML=`<video src="${url}" muted preload="metadata"></video>`;
      else el.textContent='♫';
    });
  }
}
function updateBibleChapterOptions() {
  const select=$('bibleChapter'); if(!select) return;
  const book=$('bibleBook')?.value||'';
  const current=select.value;
  const chapters=[...new Set(bibleVerses.filter(v=>!book||v.book===book).map(v=>v.chapter))].sort((a,b)=>a-b);
  select.innerHTML='<option value="">Tutti i capitoli</option>'+chapters.map(n=>`<option value="${n}">${n}</option>`).join('');
  select.disabled=!book;
  if(chapters.includes(Number(current))) select.value=current;
}
function renderBibleResults() {
  const el=$('bibleResults'); if(!el) return;
  const q=($('bibleQuery')?.value||'').trim().toLocaleLowerCase('it');
  const translation=$('bibleTranslation')?.value||'';
  const book=$('bibleBook')?.value||'';
  const chapter=Number($('bibleChapter')?.value||0);
  let rows=bibleVerses;
  if(translation) rows=rows.filter(v=>v.translation===translation);
  if(book) rows=rows.filter(v=>v.book===book);
  if(chapter) rows=rows.filter(v=>v.chapter===chapter);
  if(q) rows=rows.filter(v=>`${v.book} ${v.chapter}:${v.verse} ${v.text} ${v.translation}`.toLocaleLowerCase('it').includes(q));
  rows=rows.slice(0,100);
  if(!bibleVerses.length) { el.innerHTML='<div class="empty-state">Nessuna Bibbia importata. Importa una traduzione in formato JSON, CSV o TXT.</div>'; return; }
  if(!q&&!book) { el.innerHTML='<div class="empty-state">Scrivi una parola o scegli un libro per visualizzare i versetti.</div>'; return; }
  el.innerHTML=rows.length?rows.map(v=>`<div class="bible-result"><span><b>${escapeHTML(v.book)} ${v.chapter}:${v.verse}</b> <small>· ${escapeHTML(v.translation||'')}</small><br>${escapeHTML(v.text)}</span><button class="small-btn" data-action="add-bible-verse" data-id="${escapeHTML(v.id)}">Aggiungi</button></div>`).join(''):'<div class="empty-state">Nessun risultato trovato.</div>';
}
function renderPreview() {
  const content=currentContent(), theme=currentTheme(), baseStyle=theme.style||{}, formatting=currentSlide()?.importFormatting||{}, style={...baseStyle,fontFamily:formatting.font||baseStyle.fontFamily,fontSize:formatting.fontSize||baseStyle.fontSize,color:formatting.color||baseStyle.color,fontWeight:formatting.bold===undefined?baseStyle.fontWeight:(formatting.bold?700:400),fontStyle:formatting.italic===undefined?baseStyle.fontStyle:(formatting.italic?'italic':'normal'),textDecoration:formatting.underline===undefined?baseStyle.textDecoration:(formatting.underline?'underline':'none')};
  const canvas=$('previewCanvas'), background=$('previewBackground'), overlay=$('previewOverlay'), text=$('previewText');
  canvas.style.backgroundColor=style.backgroundColor||'#111827';
  background.innerHTML=''; background.style.backgroundImage='none';
  const bgAsset=assetById(content.kind==='media'?content.mediaId:style.bgMediaId);
  if(bgAsset) assetUrl(bgAsset).then(url=>{
    if(!background.isConnected) return;
    if(bgAsset.kind==='image') background.style.backgroundImage=`url("${url}")`;
    else if(bgAsset.kind==='video') background.innerHTML=`<video src="${url}" autoplay muted loop playsinline></video>`;
  });
  overlay.style.opacity=String(Math.max(0,Math.min(90,Number(style.overlay)||0))/100);
  overlay.style.background='#000';
  const isMedia=content.kind==='media';
  text.textContent=isMedia?'':(content.text||'');
  text.contentEditable=inlineEdit && !isMedia ? 'true' : 'false';
  text.spellcheck=true;
  text.style.fontFamily=style.fontFamily||'Arial'; text.style.fontSize=`${Math.max(12,Number(style.fontSize)||38)}px`;
  text.style.fontWeight=style.fontWeight||700; text.style.fontStyle=style.fontStyle||'normal'; text.style.textDecoration=style.textDecoration||'none'; text.style.color=style.color||'#fff';
  text.style.textAlign=style.align||'center'; text.style.letterSpacing=`${Number(style.letterSpacing)||0}px`;
  text.style.lineHeight=style.lineHeight||1.35; text.style.textShadow=style.shadow===false?'none':'0 2px 18px #000b';
  canvas.style.alignItems=style.position==='top'?'flex-start':style.position==='bottom'?'flex-end':'center';
  text.style.marginTop=style.position==='top'?'6%':'0'; text.style.marginBottom=style.position==='bottom'?'6%':'0';
  if(isMedia && bgAsset?.kind==='audio') text.textContent=`♫ ${bgAsset.name}`;
  const song=currentSong();
  $('previewCounter').textContent=`${selectedSlideIndex+1} / ${song?.slides?.length||1}`;
  $('slidePosition').textContent=`Slide ${selectedSlideIndex+1} di ${song?.slides?.length||1}`;
  $('slidePrevious').disabled=selectedSlideIndex<=0;
  $('slideNext').disabled=!song||selectedSlideIndex>=song.slides.length-1;
  $('duplicateSlide').disabled=!song; $('deleteSlide').disabled=!song || song.slides.length<=1;
  if(activeTab==='regia') $('previewSub').textContent=currentService()?.title||'Schermo principale · 16:9';
  updateLiveIfOnAir();
}
function renderLivePanel() {
  const dot=$('liveDot'), status=$('liveStatus'), pill=$('livePill'), box=$('liveCanvas'), txt=$('livePreviewText');
  dot.classList.toggle('on',liveMode==='normal');
  status.textContent=liveMode==='normal'?'IN DIRETTA':liveMode==='black'?'SCHERMO NERO':liveMode==='blank'?'CLEAR':'Non in diretta';
  pill.textContent=liveMode==='normal'?'LIVE':liveMode.toUpperCase(); pill.classList.toggle('on',liveMode==='normal');
  const payload=livePayload;
  box.style.background='#101722'; txt.textContent=payload?.mode==='normal'?(payload.content?.text||payload.content?.title||''):' ';
  if(payload?.mode==='black') box.style.background='#000';
  if(payload?.mode==='blank') txt.textContent='';
  if(payload?.mode==='normal') {
    const style=payload.style||{}; txt.style.fontFamily=style.fontFamily||'Arial'; txt.style.fontSize='12px'; txt.style.fontWeight=style.fontWeight||700; txt.style.fontStyle=style.fontStyle||'normal'; txt.style.textDecoration=style.textDecoration||'none'; txt.style.color=style.color||'#fff'; txt.style.textAlign=style.align||'center';
  }
  $('goLive').textContent=liveMode==='normal'?'■ Aggiorna / termina LIVE':'▶ Invia in diretta';
  $('goLive').classList.toggle('danger-btn',liveMode==='normal');
}
function setTab(tab) {
  activeTab=tab;
  if(tab!=='canti') wordsView=false;
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const meta={
    regia:['PROGRAMMA','Scaletta','REGIA DELLA CELEBRAZIONE','Scaletta e presentazione','Organizza i contenuti, prepara le slide e inviale sugli schermi.'],
    canti:['ARCHIVIO MUSICALE','Canti','EDITOR MUSICALE','Editor dei canti','Gestisci testi, strofe, ritornelli, tonalità, slide e temi assegnati.'],
    bibbia:['SCRITTURE','Bibbia','MODULO BIBBIA','Ricerca e presentazione biblica','Importa la traduzione autorizzata e prepara i versetti per la proiezione.'],
    media:['LIBRERIA','Media','GESTIONE MULTIMEDIALE','Immagini, video e audio','Archivia i file localmente e assegnali come sfondi o contenuti LIVE.'],
    temi:['PERSONALIZZAZIONE','Temi & Font','EDITOR GRAFICO','Personalizzazione completa','Crea temi, importa font e controlla l’aspetto delle parole sugli schermi.'],
    database:['ARCHIVIO LOCALE','Database','GESTIONE DATI','Database e backup','Controlla contenuti, dimensioni, importazioni e copie di sicurezza.'],
    connessioni:['PRODUZIONE','Schermi & OBS','OUTPUT E INTEGRAZIONI','Schermi esterni e OBS','Invia un’unica uscita LIVE al proiettore e al software di streaming.'],
    pdfimport:['IMPORTAZIONE','Importa PDF','PDF SONG IMPORTER','Importa brani da PDF','Estrai il testo, rimuovi accordi e note tecniche, riconosci le sezioni e controlla tutto prima di salvare.'],
    streamdeck:['CONTROLLO REMOTO','Stream Deck','TASTI PROGRAMMABILI','Stream Deck & Companion','Configura tasti fisici per slide avanti/indietro, LIVE, clear, nero, logo e apertura della regia.']
  }[tab];
  $('leftEyebrow').textContent=meta[0]; $('leftTitle').textContent=meta[1]; $('workEyebrow').textContent=meta[2]; $('workTitle').textContent=meta[3]; $('workDescription').textContent=meta[4];
  $('leftAdd').classList.toggle('hidden',!['regia','canti','media','temi'].includes(tab));
  renderLeft(); renderMainPanel(); renderPreview();
}
function renderAll() {
  $('serviceName').textContent=settings.serviceName||'Celebrazione principale';
  renderLeft(); renderMainPanel(); renderPreview(); renderLivePanel(); updateFooter();
  $('displayCount').textContent=displayInfo.displays.length?`${displayInfo.displays.length} rilevati`:'Solo finestra';
}

async function addFreeText() {
  const title=prompt('Titolo del testo da proiettare:','Testo libero');
  if(title===null)return;
  const item={id:uid('service'),type:'text',title:title.trim()||'Testo libero',text:'Scrivi qui il testo da proiettare.',order:Date.now()};
  await dbPut('services',item);services.push(item);activeServiceId=item.id;selectedSlideIndex=0;setTab('regia');
  inlineEdit=false;toast('Testo libero creato. Puoi modificarlo nel pannello o direttamente nell’anteprima.');
}
async function addSong() {
  const title=prompt('Titolo del nuovo canto:','Nuovo canto'); if(!title?.trim()) return;
  const song={id:uid('song'),title:title.trim(),author:'',key:'',themeId:currentTheme().id,slides:[{id:uid('slide'),text:'Scrivi qui la prima strofa'}]};
  await dbPut('songs',song); songs.push(song); selectedSongId=song.id; selectedSlideIndex=0;
  const service={id:uid('service'),type:'song',songId:song.id,title:song.title,order:Date.now()}; await dbPut('services',service); services.push(service); activeServiceId=service.id;
  setTab('canti'); toast('Canto creato e salvato nel database.');
}
async function addSlide() {
  const song=currentSong(); if(!song) { toast('Seleziona prima un canto.',true); return; }
  song.slides.splice(selectedSlideIndex+1,0,{id:uid('slide'),text:'Nuova slide'}); selectedSlideIndex++;
  await dbPut('songs',song); await loadData(); renderAll(); setTab('canti');
}
async function saveSongFields() {
  const song=songs.find(s=>s.id===selectedSongId); if(!song) return;
  song.title=$('songTitle')?.value.trim()||song.title; song.author=$('songAuthor')?.value.trim()||''; song.key=$('songKey')?.value.trim()||'';
  song.themeId=$('songTheme')?.value||song.themeId;
  if(song.slides[selectedSlideIndex] && $('slideContent')) song.slides[selectedSlideIndex].text=$('slideContent').value;
  await dbPut('songs',song);
  for(const service of services.filter(s=>s.type==='song'&&s.songId===song.id)){service.title=song.title; await dbPut('services',service);}
  await loadData(); markSaved(); renderAll(); setTab('canti');
}
async function persistSlideText() {
  const song=currentSong(); if(!song||!song.slides[selectedSlideIndex]) return;
  song.slides[selectedSlideIndex].text=$('slideContent').value;
  await dbPut('songs',song); renderPreview(); markSaved();
}
async function moveSlide(index,delta) {
  const song=currentSong(); if(!song) return;
  const next=index+delta; if(next<0||next>=song.slides.length) return;
  [song.slides[index],song.slides[next]]=[song.slides[next],song.slides[index]];
  selectedSlideIndex=next; await dbPut('songs',song); renderAll();
}
async function selectService(id) {
  activeServiceId=id; const s=currentService();
  if(s?.type==='song'){selectedSongId=s.songId;selectedSlideIndex=0;}
  else selectedSlideIndex=0;
  renderAll();
}
async function selectSong(id) {
  selectedSongId=id; selectedSlideIndex=0;
  const service=services.find(s=>s.type==='song'&&s.songId===id);
  if(service) activeServiceId=service.id;
  renderAll();
}
async function saveThemeFields() {
  const theme=currentTheme();
  theme.name=$('themeName')?.value.trim()||theme.name;
  const st=theme.style||{};
  st.backgroundColor=$('themeBackground')?.value||st.backgroundColor;
  st.bgMediaId=$('themeMedia')?.value||null;
  st.fontFamily=$('themeFont')?.value||'Arial';
  st.fontSize=Number($('themeSize')?.value)||38; st.color=$('themeColor')?.value||'#fff';
  st.fontWeight=Number($('themeWeight')?.value)||700; st.align=$('themeAlign')?.value||'center'; st.position=$('themePosition')?.value||'center';
  st.overlay=Number($('themeOverlay')?.value)||0; st.shadow=$('themeShadow')?.value!=='false';
  st.letterSpacing=Number($('themeLetterSpacing')?.value)||0; st.lineHeight=Number($('themeLineHeight')?.value)||1.35;
  theme.style=st; await dbPut('themes',theme); await dbPut('settings',{key:'activeThemeId',value:theme.id});
  if(currentSong()) {const song=currentSong();song.themeId=theme.id;await dbPut('songs',song);}
  await loadData(); renderPreview(); updateLiveIfOnAir(); markSaved(); toast('Tema salvato.');
}
async function newTheme() {
  const name=prompt('Nome del nuovo tema:','Nuovo tema'); if(!name?.trim()) return;
  const base=JSON.parse(JSON.stringify(currentTheme()));
  base.id=uid('theme');base.name=name.trim();await dbPut('themes',base);themes.push(base);selectedThemeId=base.id;
  const song=currentSong(); if(song){song.themeId=base.id;await dbPut('songs',song);}
  renderAll();setTab('temi');toast('Nuovo tema creato.');
}
async function importMediaFiles(files, autoBackground=false) {
  let done=0;
  for(const file of files) {
    const kind=file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':null;
    if(!kind) continue;
    const item={id:uid('media'),name:file.name,mime:file.type,kind,blob:null,size:file.size,createdAt:Date.now()};
    try {
      if(window.wspDesktop?.getPathForFile && window.wspDesktop?.saveMediaFile){
        const filePath=window.wspDesktop.getPathForFile(file);
        if(!filePath) throw new Error('Il sistema non ha fornito il percorso del file.');
        await window.wspDesktop.saveMediaFile({id:item.id,name:item.name,mime:item.mime,kind:item.kind,filePath});
      } else { item.blob=file; }
      await dbPut('media',item); assets.unshift(item); done++;
    } catch(e) { console.error(e); toast(`Impossibile archiviare ${file.name}: ${e.message}`,true); break; }
  }
  if(done){
    if(autoBackground){const first=assets.find(a=>a.kind==='image'||a.kind==='video');if(first){const theme=currentTheme();theme.style.bgMediaId=first.id;await dbPut('themes',theme);}}
    renderAll();setTab(autoBackground?'regia':'media');toast(`${done} file importati e salvati nel database locale.${autoBackground?' Sfondo applicato.':''}`);
  }
}
async function importFonts(files) {
  let done=0;
  for(const file of files) {
    const ext=file.name.split('.').pop().toLowerCase();
    if(!['ttf','otf','woff','woff2'].includes(ext)) continue;
    const family=file.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ');
    const item={id:uid('font'),name:file.name,mime:file.type||`font/${ext}`,kind:'font',fontFamily:family,blob:null,size:file.size,createdAt:Date.now()};
    try {
      if(window.wspDesktop?.getPathForFile && window.wspDesktop?.saveMediaFile){const filePath=window.wspDesktop.getPathForFile(file);if(!filePath)throw new Error('Percorso font non disponibile.');await window.wspDesktop.saveMediaFile({id:item.id,name:item.name,mime:item.mime,kind:item.kind,fontFamily:item.fontFamily,filePath});}
      else item.blob=file;
      await dbPut('media',item);assets.unshift(item);done++;
    } catch(e){toast(`Impossibile salvare il font: ${e.message}`,true);break;}
  }
  await loadCustomFonts();renderAll();setTab('temi');if(done)toast(`${done} font importati. Ora li trovi nel menu Font.`);
}
async function setBackgroundFromMedia(id) {
  const theme=currentTheme();theme.style.bgMediaId=id;
  await dbPut('themes',theme);await loadData();renderAll();setTab('temi');updateLiveIfOnAir();toast('Media impostato come sfondo del tema.');
}
async function addMediaToService(id) {
  const asset=assetById(id);if(!asset)return;
  const item={id:uid('service'),type:'media',mediaId:id,title:asset.name,order:Date.now()};
  await dbPut('services',item);services.push(item);activeServiceId=item.id;renderAll();setTab('regia');toast('Media aggiunto alla scaletta.');
}
async function addVerseToService(id) {
  const v=bibleVerses.find(x=>x.id===id);if(!v)return;
  const item={id:uid('service'),type:'scripture',title:`${v.book} ${v.chapter}:${v.verse}`,text:v.text,translation:v.translation,reference:`${v.book} ${v.chapter}:${v.verse}`,order:Date.now()};
  await dbPut('services',item);services.push(item);activeServiceId=item.id;selectedSlideIndex=0;renderAll();setTab('regia');toast('Versetto aggiunto alla scaletta.');
}
async function deleteMedia(id) {
  const a=assetById(id);if(!a)return;
  if(!confirm(`Eliminare ${a.name} dal database locale?`))return;
  await dbDelete('media',id);if(window.wspDesktop?.deleteMedia)await window.wspDesktop.deleteMedia(id).catch(()=>{});assets=assets.filter(x=>x.id!==id);if(settings.defaultLogoId===id){settings.defaultLogoId=null;await dbPut('settings',{key:'defaultLogoId',value:null});}
  if(objectUrls.has(id)){URL.revokeObjectURL(objectUrls.get(id));objectUrls.delete(id);}
  for(const t of themes){if(t.style?.bgMediaId===id){t.style.bgMediaId=null;await dbPut('themes',t);}}
  renderAll();setTab('media');toast('File eliminato dall’archivio locale.');
}

let pdfImportedDraft=null;
let streamDeckInfo=null;
let streamDeckPollTimer=null;

function normalizePdfLines(raw) {
  let lines=String(raw||'').replace(/\u00a0/g,' ').replace(/\r/g,'\n').split('\n').map(x=>x.replace(/[ \t]+/g,' ').trim());
  lines=lines.filter(Boolean);
  // Remove recurring page headers/footers and common notation/editorial metadata.
  const counts=new Map(); for(const line of lines){const k=line.toLocaleLowerCase('it');counts.set(k,(counts.get(k)||0)+1);}
  const repeated=new Set([...counts].filter(([,n])=>n>=3).map(([k])=>k));
  const meta=/^(?:www\.|https?:\/\/|©|copyright\b|ccli\b|licenza\b|lyrics?\b|testo\s*[:：]|autore\s*[:：]|compositore\s*[:：]|capo\s*[:：]?\s*\d*|bpm\s*[:：]?\s*\d*|tempo\s*[:：]|tonalit[aà]\s*[:：]|key\s*[:：]|accordi\s*[:：]|chords?\s*[:：]|pagina\s+\d+|page\s+\d+)$/i;
  return lines.filter(line=>{
    if(repeated.has(line.toLocaleLowerCase('it')))return false;
    if(meta.test(line))return false;
    if(/^(?:pag\.?\s*)?\d{1,3}$/.test(line))return false;
    if(/^(?:www\.|https?:\/\/)/i.test(line))return false;
    return true;
  }).map(line=>line
    .replace(/\[[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add)?\d*(?:\/[A-G](?:#|b)?)?\]/g,' ')
    .replace(/\((?:[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add)?\d*(?:\/[A-G](?:#|b)?)?)(?:\s+[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add)?\d*)*\)/g,' ')
    .replace(/\s{2,}/g,' ').trim()).filter(Boolean);
}
function isChordOnlyLine(line) {
  const tokens=line.replace(/[|,;]/g,' ').trim().split(/\s+/).filter(Boolean);
  if(!tokens.length)return true;
  const chord=/^(?:[A-G](?:#|b)?)(?:(?:m|min|maj|sus|dim|aug|add|M|mM)\d*)?(?:\/[A-G](?:#|b)?)?$/;
  const chordLike=tokens.filter(t=>chord.test(t)).length;
  return chordLike===tokens.length && tokens.length<=12;
}
function classifyPdfHeading(line) {
  const s=line.toLocaleLowerCase('it').replace(/[\[\](){}:.\-]/g,' ').replace(/\s+/g,' ').trim();
  const rules=[
    [/^(intro|intro strumentale|introduzione|instrumental intro)$/, 'INTRO'],
    [/^(verse|verso|strofa|stanza)(\s*[0-9ivx]+)?$/, 'VERSE'],
    [/^(pre chorus|prechorus|pre ritornello|pre-chorus)$/, 'PRE-CHORUS'],
    [/^(chorus|ritornello|refrain)(\s*[0-9]+)?$/, 'CHORUS'],
    [/^(bridge|ponte)(\s*[0-9]+)?$/, 'BRIDGE'],
    [/^(instrumental|strumentale|interludio|intermezzo)$/, 'INSTRUMENTAL'],
    [/^(vamp|ripetere|repeat)(\s*[0-9x]+)?$/, 'VAMP'],
    [/^(tag|coda)$/, 'TAG'],
    [/^(final|finale|ending)$/, 'FINAL'],
    [/^(outro|conclusione)$/, 'OUTRO']
  ];
  for(const [re,label] of rules)if(re.test(s))return label;
  return null;
}
function parsePdfSong(raw, filename) {
  const lines=normalizePdfLines(raw).filter(x=>!isChordOnlyLine(x));
  let title=(filename||'').replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim();
  const clean=[]; let author='';
  for(const line of lines){
    if(!title && clean.length===0){title=line;continue;}
    if(!author && /^(?:testo|parole|musica|autore|words|music)\s*[:：]/i.test(line)){if(/^autore/i.test(line))author=line.split(/[:：]/).slice(1).join(':').trim();continue;}
    clean.push(line);
  }
  const sections=[];let current={section:'VERSE',text:[]};
  const flush=()=>{const text=current.text.join('\n').trim();if(text)sections.push({section:current.section,text});};
  for(const line of clean){
    const heading=classifyPdfHeading(line);
    if(heading){flush();current={section:heading,text:[]};continue;}
    if(/^(?:x\s*\d+|ripeti(?:ere)?(?:\s+\d+x)?|repeat(?:\s+\d+x)?|2x|3x)$/i.test(line))continue;
    current.text.push(line);
  }
  flush();
  // Merge consecutive repeated section headings to avoid one slide per line; retain explicit section order.
  return {title,author,sections:sections.length?sections:[{section:'VERSE',text:clean.join('\n')}].filter(x=>x.text)};
}
function renderPdfDraft() {
  const el=$('pdfSections'); if(!el)return;
  if(!pdfImportedDraft?.sections?.length){el.innerHTML='<div class="empty-state">Nessuna sezione rilevata. Verifica il testo estratto.</div>';$('pdfImportButton').disabled=true;return;}
  el.innerHTML=pdfImportedDraft.sections.map((s,i)=>`<div class="pdf-section"><select data-pdf-section="${i}">${['INTRO','VERSE','PRE-CHORUS','CHORUS','BRIDGE','INSTRUMENTAL','VAMP','TAG','FINAL','OUTRO'].map(v=>`<option ${s.section===v?'selected':''}>${v}</option>`).join('')}</select><textarea data-pdf-text="${i}">${escapeHTML(s.text)}</textarea></div>`).join('');
  $('pdfImportButton').disabled=false;
}
async function extractPdf(file, forceOcr=false) {
  if(!file)return;
  if(file.size>80*1024*1024){toast('PDF troppo grande: limite 80 MB.',true);return;}
  if(!window.wspDesktop?.extractPdfText){toast('L’estrazione PDF richiede l’app desktop installata.',true);return;}
  try{
    $('pdfFileName').textContent=file.name+' · '+fmtBytes(file.size);
    const filePath=window.wspDesktop.getPathForFile(file);
    if(!filePath)throw new Error('Percorso PDF non accessibile. Apri il progetto desktop.');
    const result=await window.wspDesktop.extractPdfText(filePath,forceOcr);
    $('pdfRawText').value=result.text||'';
    if(!result.text?.trim())toast('Non è stato riconosciuto testo nel PDF.',true);
    else toast(`${result.method==='ocr'?'OCR completato':'Testo estratto'} · ${result.pages} pagine. Controlla il risultato prima dell’analisi.`);
  }catch(e){console.error(e);toast('Errore estrazione PDF: '+e.message,true);}
}
async function importPdfDraft() {
  if(!pdfImportedDraft)return;
  const title=$('pdfSongTitle')?.value.trim()||pdfImportedDraft.title||'Brano importato da PDF';
  const sections=[...document.querySelectorAll('[data-pdf-section]')].map((select,i)=>({section:select.value,text:document.querySelector(`[data-pdf-text="${i}"]`)?.value.trim()||''})).filter(x=>x.text);
  if(!sections.length){toast('Non ci sono sezioni con testo da importare.',true);return;}
  const song={id:uid('song'),title,author:$('pdfSongAuthor')?.value.trim()||'',key:'',themeId:currentTheme().id,source:'PDF',sourceFile:$('pdfFileName')?.textContent||'',slides:sections.map(x=>({id:uid('slide'),section:x.section,text:x.text}))};
  await dbPut('songs',song);songs.push(song);selectedSongId=song.id;
  const service={id:uid('service'),type:'song',songId:song.id,title:song.title,order:Date.now()};await dbPut('services',service);services.push(service);activeServiceId=service.id;
  selectedSlideIndex=0;await loadData();renderAll();setTab('canti');toast(`Brano “${title}” importato con ${sections.length} sezioni.`);
}
async function loadStreamDeckInfo() {
  if(!window.wspDesktop?.getStreamDeckInfo)return;
  try{streamDeckInfo=await window.wspDesktop.getStreamDeckInfo();}catch(e){console.warn(e);}
}
async function runStreamDeckAction(action) {
  try{
    if(action==='open-app')return;
    if(action==='next'){const song=currentSong();selectedSlideIndex=Math.min((song?.slides.length||1)-1,selectedSlideIndex+1);renderAll();updateLiveIfOnAir();}
    else if(action==='previous'){selectedSlideIndex=Math.max(0,selectedSlideIndex-1);renderAll();updateLiveIfOnAir();}
    else if(action==='live')setLive('normal');
    else if(action==='clear')setLive('blank');
    else if(action==='black')setLive('black');
    else if(action==='logo'){
      const logo=assetById(settings.defaultLogoId)||assets.find(a=>a.kind==='image'&&/logo/i.test(a.name));
      const theme=currentTheme();
      liveMode='normal';livePayload={mode:'normal',content:logo?{kind:'media',mediaId:logo.id,title:logo.name}:{kind:'text',text:'WORSHIP STUDIO PRO',reference:'Logo'},style:{...(theme.style||{}),fontSize:54},updatedAt:Date.now()};
      broadcastLive();renderLivePanel();
    }
  }catch(e){console.error('Stream Deck action failed',e);toast('Comando Stream Deck non riuscito: '+e.message,true);}
}
async function pollStreamDeckCommands() {
  if(!window.wspDesktop)return;
  try{
    const r=await fetch('/api/streamdeck/commands?token='+encodeURIComponent(streamDeckInfo?.token||''),{cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json();
    for(const command of data.commands||[])await runStreamDeckAction(command.action);
  }catch(e){}
}

async function handleAction(action, target) {
  const id=target.dataset.id;
  switch(action) {
    case 'toggle-appearance': await toggleAppearance(); break;
    case 'toggle-words-view': wordsView=!wordsView; renderMainPanel(); break;
    case 'words-live': selectedSlideIndex=Number(target.dataset.index)||0; renderAll(); setLive('normal'); break;
    case 'set-default-logo': {const a=assetById(id);if(!a||a.kind!=='image'){toast('Seleziona un’immagine per il logo.',true);break;}settings.defaultLogoId=id;await dbPut('settings',{key:'defaultLogoId',value:id});renderMainPanel();toast(`Logo predefinito impostato: ${a.name}`);break;}
    case 'live': setLive('normal'); break;
    case 'black': setLive('black'); break;
    case 'clear': setLive('blank'); break;
    case 'logo': await runStreamDeckAction('logo'); break;
    case 'slide-previous': selectedSlideIndex=Math.max(0,selectedSlideIndex-1);renderAll();updateLiveIfOnAir();break;
    case 'slide-next': {const song=currentSong();selectedSlideIndex=Math.min((song?.slides.length||1)-1,selectedSlideIndex+1);renderAll();updateLiveIfOnAir();break;}
    case 'new-schedule': {if(confirm('Creare una nuova scaletta vuota? I contenuti salvati nella libreria non verranno eliminati.')){for(const item of services)await dbDelete('services',item.id);services=[];activeServiceId=null;renderAll();setTab('regia');toast('Nuova scaletta creata.');}break;}
    case 'edit-current-text': setTab('canti');wordsView=false;renderMainPanel();$('slideContent')?.focus();break;
    case 'duplicate-current-slide': {const song=currentSong();if(song){const copy={...song.slides[selectedSlideIndex],id:uid('slide')};song.slides.splice(selectedSlideIndex+1,0,copy);selectedSlideIndex++;await dbPut('songs',song);renderAll();setTab('canti');}break;}
    case 'pick-pdf': $('pdfPicker').click(); break;
    case 'force-pdf-ocr': {const file=$('pdfPicker').files?.[0];if(!file){toast('Seleziona prima un PDF.',true);break;}await extractPdf(file,true);break;}
    case 'parse-pdf': {const raw=$('pdfRawText')?.value||'';pdfImportedDraft=parsePdfSong(raw,$('pdfFileName')?.textContent||'Brano.pdf');$('pdfSongTitle').value=pdfImportedDraft.title||'';renderPdfDraft();toast(`Riconosciute ${pdfImportedDraft.sections.length} sezioni. Verifica i risultati.`);break;}
    case 'import-pdf-song': await importPdfDraft(); break;
    case 'reset-pdf': pdfImportedDraft=null;$('pdfRawText').value='';$('pdfFileName').textContent='Nessun file selezionato';$('pdfSections').innerHTML='<div class="empty-state">Carica un PDF.</div>';$('pdfImportButton').disabled=true;break;
    case 'copy-deck-token': await navigator.clipboard.writeText(streamDeckInfo?.token||'');toast('Token copiato.');break;
    case 'refresh-deck-info': await loadStreamDeckInfo();renderMainPanel();toast('Informazioni Stream Deck aggiornate.');break;
    case 'select-service': await selectService(id); break;
    case 'select-song': await selectSong(id);setTab('canti');break;
    case 'select-slide': selectedSlideIndex=Number(target.dataset.index)||0;renderAll();break;
    case 'new-song': await addSong();break;
    case 'easyworship-import': $('easyWorshipPicker').click();break;
    case 'easyworship-folder': $('easyWorshipFolderPicker').click();break;
    case 'add-service': setTab('canti');toast('Seleziona un canto, importa una Bibbia o aggiungi un media.');break;
    case 'add-free-text': await addFreeText();break;
    case 'edit-song': setTab('canti');break;
    case 'add-slide': await addSlide();break;
    case 'move-slide-up': await moveSlide(Number(target.dataset.index),-1);break;
    case 'move-slide-down': await moveSlide(Number(target.dataset.index),1);break;
    case 'save-song': await saveSongFields();break;
    case 'add-song-to-service': {const song=songs.find(s=>s.id===selectedSongId);if(song){const s={id:uid('service'),type:'song',songId:song.id,title:song.title,order:Date.now()};await dbPut('services',s);services.push(s);activeServiceId=s.id;setTab('regia');toast('Canto aggiunto alla scaletta.');}break;}
    case 'duplicate-song': {const song=songs.find(s=>s.id===selectedSongId);if(song){const copy=JSON.parse(JSON.stringify(song));copy.id=uid('song');copy.title+=' (copia)';copy.slides=copy.slides.map(s=>({...s,id:uid('slide')}));await dbPut('songs',copy);songs.push(copy);selectedSongId=copy.id;renderAll();setTab('canti');}break;}
    case 'delete-song': {const song=songs.find(s=>s.id===selectedSongId);if(song&&confirm(`Eliminare il canto “${song.title}”?`)){await dbDelete('songs',song.id);for(const s of services.filter(x=>x.songId===song.id)){await dbDelete('services',s.id);}await loadData();selectedSongId=songs[0]?.id||null;activeServiceId=services[0]?.id||null;renderAll();setTab('canti');}break;}
    case 'split-song': {const song=songs.find(s=>s.id===selectedSongId);const text=$('slideContent')?.value||'';if(song&&text.trim()){const chunks=text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);if(chunks.length>1){song.slides=chunks.map(text=>({id:uid('slide'),text}));selectedSlideIndex=0;await dbPut('songs',song);await loadData();renderAll();toast(`${chunks.length} slide create dal testo.`);}else toast('Inserisci una riga vuota tra le slide per dividerle.');}break;}
    case 'move-service-up': case 'move-service-down': {const i=services.findIndex(s=>s.id===activeServiceId), j=i+(action==='move-service-up'?-1:1);if(i>=0&&j>=0&&j<services.length){[services[i].order,services[j].order]=[services[j].order,services[i].order];await dbPut('services',services[i]);await dbPut('services',services[j]);services.sort((a,b)=>a.order-b.order);renderAll();}break;}
    case 'remove-service': {const s=currentService();if(s){await dbDelete('services',s.id);services=services.filter(x=>x.id!==s.id);activeServiceId=services[0]?.id||null;selectedSlideIndex=0;renderAll();}break;}
    case 'save-service-title': {const s=currentService();if(s){s.title=$('serviceTitleEdit')?.value.trim()||s.title;await dbPut('services',s);if(s.type==='song'){const song=songs.find(x=>x.id===s.songId);if(song){song.title=s.title;await dbPut('songs',song);}}await loadData();renderAll();}break;}
    case 'save-service-text': {const s=currentService();if(s){s.text=$('serviceTextEdit').value;await dbPut('services',s);renderPreview();updateLiveIfOnAir();markSaved();}break;}
    case 'select-tab': setTab(target.dataset.tab);break;
    case 'import-media': $('mediaPicker').click();break;
    case 'select-media': selectedMediaId=id;renderAll();break;
    case 'set-background': await setBackgroundFromMedia(id);break;
    case 'add-media-service': await addMediaToService(id);break;
    case 'delete-media': await deleteMedia(id);break;
    case 'import-fonts': $('fontPicker').click();break;
    case 'select-theme': {selectedThemeId=id;const s=currentSong();if(s){s.themeId=id;await dbPut('songs',s);}await dbPut('settings',{key:'activeThemeId',value:id});renderAll();setTab('temi');break;}
    case 'new-theme': await newTheme();break;
    case 'save-theme': await saveThemeFields();break;
    case 'duplicate-theme': {const copy=JSON.parse(JSON.stringify(currentTheme()));copy.id=uid('theme');copy.name+=' (copia)';await dbPut('themes',copy);themes.push(copy);selectedThemeId=copy.id;const s=currentSong();if(s){s.themeId=copy.id;await dbPut('songs',s);}renderAll();setTab('temi');toast('Tema duplicato.');break;}
    case 'remove-theme': {const t=currentTheme();if(themes.length<=1){toast('Deve restare almeno un tema.',true);break;}if(confirm(`Eliminare il tema “${t.name}”?`)){await dbDelete('themes',t.id);themes=themes.filter(x=>x.id!==t.id);for(const s of songs){if(s.themeId===t.id)s.themeId=themes[0].id;await dbPut('songs',s);}selectedThemeId=themes[0].id;await dbPut('settings',{key:'activeThemeId',value:selectedThemeId});renderAll();setTab('temi');}break;}
    case 'import-bible': $('biblePicker').click();break;
    case 'bible-format': showBibleFormat();break;
    case 'add-bible-verse': await addVerseToService(id);break;
    case 'bible-book': setTab('bibbia');setTimeout(()=>{if($('bibleBook')){$('bibleBook').value=target.dataset.book;renderBibleResults();}},0);break;
    case 'backup-export': await exportBackup();break;
    case 'backup-import': $('backupPicker').click();break;
    case 'db-refresh': await loadData();renderAll();toast('Statistiche aggiornate.');break;
    case 'refresh-displays': await refreshDisplayInfo();setTab('connessioni');toast('Elenco monitor aggiornato.');break;
    case 'open-output': await openOutput(target.dataset.id);break;
    case 'close-output': if(window.wspDesktop) await window.wspDesktop.closeOutput();toast('Finestra LIVE chiusa.');break;
    case 'copy-output-url': await navigator.clipboard.writeText($('outputUrl')?.value||displayInfo.outputUrl);toast('URL OBS copiato.');break;
    case 'toggle-fullscreen': if(window.wspDesktop) await window.wspDesktop.toggleMainFullscreen();break;
    case 'obs-connect': await connectOBS();break;
    case 'obs-disconnect': disconnectOBS();break;
    case 'obs-create-source': await createOBSSource();break;
  }
}

// EasyWorship migration helpers. EasyWorship documents support RTF/TXT song import;
// full profile backups contain proprietary databases, so we migrate exported songs
// plus accessible media/fonts/themes rather than pretending to decode undocumented DB files.
const SONG_SECTION_ALIASES = [
  [/^(intro(?:\s+instrumental)?|instrumental\s+intro|intro\s+strumentale)$/i,'Intro instrumental'],
  [/^(verse|strofa|stanza)(?:\s*\d+)?$/i,'Strofa'],
  [/^(pre[- ]?chorus|pre[- ]?ritornello)$/i,'Pre-ritornello'],
  [/^(chorus|ritornello|refrain)$/i,'Ritornello'],
  [/^(bridge|ponte)$/i,'Bridge'],
  [/^(final|finale|ending|outro)$/i,'Finale'],
  [/^(tag|coda)$/i,'Tag'],
  [/^(vamp)$/i,'Vamp'],
  [/^(interlude|instrumental|intermezzo)$/i,'Interludio strumentale']
];
function normalizeSongSection(label) {
  const clean=String(label||'').replace(/[\[\]{}:]/g,'').trim();
  const numbered=clean.match(/^(?:verse|strofa|stanza)\s*(\d+)$/i);
  if(numbered)return `Strofa ${numbered[1]}`;
  const chorusNumber=clean.match(/^(?:chorus|ritornello)\s*(\d+)$/i);
  if(chorusNumber)return `Ritornello ${chorusNumber[1]}`;
  const bridgeNumber=clean.match(/^(?:bridge|ponte)\s*(\d+)$/i);
  if(bridgeNumber)return `Bridge ${bridgeNumber[1]}`;
  for(const [rx,name] of SONG_SECTION_ALIASES) if(rx.test(clean)) return name;
  return clean || 'Strofa';
}
function extractRtfDestination(source, destination) {
  const start=source.search(new RegExp('\\{\\\\'+destination+'\\b','i'));
  if(start<0)return '';
  let depth=0;
  for(let i=start;i<source.length;i++){
    if(source[i]==='\\'){i++;continue;}
    if(source[i]==='{')depth++;
    else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
  }
  return '';
}
function stripRtfDestination(source, destination) {
  const group=extractRtfDestination(source,destination);
  return group?source.replace(group,''):source;
}
function decodeRtf(input) {
  let text=String(input||'');
  if(!/^\s*\{\\rtf/i.test(text)) return {text:text.replace(/\r/g,''),font:'',fontSize:38,color:'#ffffff',bold:false,italic:false,underline:false};
  const fontTable={},colorTable=[];
  const fontBlock=extractRtfDestination(text,'fonttbl');
  if(fontBlock){const re=/\\f(\d+)([^;{}]*);/g;let m;while((m=re.exec(fontBlock))){const family=m[2].replace(/\\[a-zA-Z]+-?\d* ?/g,'').trim();if(family)fontTable[Number(m[1])]=family;}}
  const colorBlock=extractRtfDestination(text,'colortbl');
  if(colorBlock){const body=colorBlock.replace(/^\{\\colortbl/i,'').replace(/\}$/,'');for(const entry of body.split(';').slice(1)){const r=+(entry.match(/\\red(\d+)/)||[])[1]||0,g=+(entry.match(/\\green(\d+)/)||[])[1]||0,b=+(entry.match(/\\blue(\d+)/)||[])[1]||0;colorTable.push('#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''));}}
  let body=text;
  for(const destination of ['fonttbl','colortbl','stylesheet','info','generator'])body=stripRtfDestination(body,destination);
  body=body.replace(/\\\*\\[a-zA-Z]+[\s\S]*?(?=\\par|})/g,'');
  let out='',stack=[],state={font:0,size:24,bold:false,italic:false,underline:false,color:0};
  const tokens=body.match(/\\'[0-9a-fA-F]{2}|\\u-?\d+\??|\\[a-zA-Z]+-?\d* ?|\\[^a-zA-Z]|[{}]|[^\\{}]+/g)||[];
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];
    if(t==='{'){stack.push({...state});continue;} if(t==='}'){state=stack.pop()||state;continue;}
    if(t.startsWith("\\'")){out+=String.fromCharCode(parseInt(t.slice(2),16));continue;}
    if(t.startsWith('\\u')){const n=Number(t.slice(2).replace('?',''));out+=String.fromCharCode(n<0?n+65536:n);if(tokens[i+1]==='?')i++;continue;}
    if(t[0]==='\\'){
      const m=t.match(/^\\([a-zA-Z]+)(-?\d+)? ?$/);if(!m){if(t==='\\~')out+='\u00a0';else if(t==='\\-')out+='\u00ad';continue;}
      const cmd=m[1],n=m[2]===undefined?1:Number(m[2]);
      if(cmd==='par'||cmd==='line')out+='\n';else if(cmd==='tab')out+='\t';else if(cmd==='f')state.font=n;else if(cmd==='fs')state.size=n;else if(cmd==='b')state.bold=n!==0;else if(cmd==='i')state.italic=n!==0;else if(cmd==='ul'||cmd==='ulnone')state.underline=cmd==='ul';else if(cmd==='cf')state.color=n;else if(cmd==='plain')state={font:0,size:24,bold:false,italic:false,underline:false,color:0};
      continue;
    }
    out+=t;
  }
  const clean=out.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\n{3,}/g,'\n\n').trim();
  const usedFont=Number((body.match(/\\f(\d+)/)||[])[1]||0),firstFont=fontTable[usedFont]||Object.values(fontTable)[0]||'';
  const firstSize=Number((body.match(/\\fs(\d+)/)||[])[1]||48)/2;
  const firstColor=colorTable[Number((body.match(/\\cf(\d+)/)||[])[1]||0)-1]||'#ffffff';
  return {text:clean,font:firstFont,fontSize:Math.max(12,Math.min(120,firstSize)),color:firstColor,bold:/\\b(?!0)/.test(body),italic:/\\i(?!0)/.test(body),underline:/\\ul(?!none)/.test(body),fontTable,colorTable};
}
function splitImportedSongText(raw, fallbackTitle) {
  const lines=String(raw||'').replace(/\r/g,'').split('\n');
  let title=fallbackTitle,author='',key='',sections=[],current={section:'Strofa',lines:[]};
  const flush=()=>{const txt=current.lines.join('\n').trim();if(txt)sections.push({section:normalizeSongSection(current.section),text:txt});current={section:'Strofa',lines:[]};};
  for(let line of lines){const t=line.trim();if(!t){if(current.lines.length)current.lines.push('');continue;}
    let m=t.match(/^(?:\[|\{)?(Intro(?:\s+Instrumental)?|Instrumental(?:\s+Intro)?|Verse\s*\d*|Strofa\s*\d*|Pre[- ]?Chorus|Pre[- ]?Ritornello|Chorus|Ritornello|Bridge|Ponte|Finale?|Ending|Outro|Tag|Vamp|Interlude|Intermezzo)(?:\]|\})?:?$/i);
    if(m){flush();current.section=m[1];continue;}
    m=t.match(/^(?:Titolo|Title)\s*:\s*(.+)$/i);if(m){title=m[1].trim();continue;}
    m=t.match(/^(?:Autore|Author)\s*:\s*(.+)$/i);if(m){author=m[1].trim();continue;}
    m=t.match(/^(?:Tonalit[àa]|Key)\s*:\s*(.+)$/i);if(m){key=m[1].trim();continue;}
    current.lines.push(line);
  }
  flush();
  if(!sections.length){const chunks=String(raw||'').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);sections=chunks.map((text,i)=>({section:i===0?'Strofa':'Strofa',text}));}
  return {title,author,key,sections};
}

async function importEasyWorshipSqlite(songsDbFile, songWordsDbFile) {
  if(!window.wspDesktop?.readEasyWorshipDatabase || !window.wspDesktop?.getPathForFile) throw new Error('La lettura diretta del database richiede l’app desktop Worship Studio Pro.');
  const songsDbPath=window.wspDesktop.getPathForFile(songsDbFile), songWordsDbPath=window.wspDesktop.getPathForFile(songWordsDbFile);
  if(!songsDbPath||!songWordsDbPath) throw new Error('Non riesco a leggere il percorso dei due database.');
  const result=await window.wspDesktop.readEasyWorshipDatabase({songsDbPath,songWordsDbPath});
  let count=0,duplicates=0;
  for(const row of result.songs||[]){
    const title=String(row.title||'').trim();if(!title)continue;
    if(songs.some(x=>x.title.trim().toLocaleLowerCase('it')===title.toLocaleLowerCase('it'))){duplicates++;continue;}
    const wordRows=Array.isArray(row.wordRows)?row.wordRows:[];
    const firstParsed=decodeRtf(String(wordRows[0]?.words||row.words||''));
    let sections=[];
    if(wordRows.length>1){
      wordRows.forEach((wordRow,index)=>{
        const parsedWord=decodeRtf(String(wordRow.words||''));
        if(!parsedWord.text.trim())return;
        const split=splitImportedSongText(parsedWord.text,title);
        if(split.sections.length>1)sections.push(...split.sections);
        else sections.push({section:normalizeSongSection(wordRow.label||`Strofa ${index+1}`),text:parsedWord.text,formatting:parsedWord});
      });
    } else {
      const data=splitImportedSongText(decodeRtf(String(row.words||'')).text,title);
      sections=data.sections.map(x=>({...x,formatting:firstParsed}));
    }
    if(!sections.length)continue;
    const themeId=uid('theme');
    const theme={id:themeId,name:`${title} · EasyWorship`,style:{...currentTheme().style,fontFamily:firstParsed.font||currentTheme().style.fontFamily,fontSize:firstParsed.fontSize||currentTheme().style.fontSize,color:firstParsed.color||currentTheme().style.color,fontWeight:firstParsed.bold?700:currentTheme().style.fontWeight,fontStyle:firstParsed.italic?'italic':'normal',textDecoration:firstParsed.underline?'underline':'none',bgMediaId:null}};
    await dbPut('themes',theme);themes.push(theme);
    const song={id:uid('song'),title,author:String(row.author||''),copyright:String(row.copyright||''),key:'',themeId,source:'EasyWorship SQLite',sourceId:String(row.id),sourceRtf:String(row.words||''),slides:sections.map(x=>({id:uid('slide'),section:x.section,text:x.text,importFormatting:{font:x.formatting?.font||firstParsed.font,fontSize:x.formatting?.fontSize||firstParsed.fontSize,color:x.formatting?.color||firstParsed.color,bold:x.formatting?.bold??firstParsed.bold,italic:x.formatting?.italic??firstParsed.italic,underline:x.formatting?.underline??firstParsed.underline}}))};
    await dbPut('songs',song);songs.push(song);count++;
  }
  return {count,duplicates,total:result.totalSongs||0,candidates:result.importedCandidates||0};
}

async function importEasyWorshipFiles(files) {
  const dbFiles=files.filter(f=>['songs.db','songwords.db'].includes(f.name.toLowerCase()));
  let sqliteSummary=null;
  const dbDirs=[...new Set(dbFiles.map(f=>(f.webkitRelativePath||f.name).replace(/[^/\\]+$/,'')))];
  const dbPair=dbDirs.map(dir=>({dir,songs:dbFiles.find(f=>f.name.toLowerCase()==='songs.db'&&(f.webkitRelativePath||f.name).replace(/[^/\\]+$/,'')===dir),words:dbFiles.find(f=>f.name.toLowerCase()==='songwords.db'&&(f.webkitRelativePath||f.name).replace(/[^/\\]+$/,'')===dir)})).find(x=>x.songs&&x.words);
  if(dbPair){
    try{sqliteSummary=await importEasyWorshipSqlite(dbPair.songs,dbPair.words);}
    catch(e){console.error('Import database EasyWorship fallito',e);toast(`Database EasyWorship: ${e.message}`,true);}
  }
  files=files.filter(f=>!['songs.db','songwords.db'].includes(f.name.toLowerCase()));
  const songFiles=[],mediaFiles=[],fontFiles=[],themeFiles=[];let ignored=0;
  for(const f of files){const ext=(f.name.split('.').pop()||'').toLowerCase();
    if(['rtf','txt'].includes(ext))songFiles.push(f);
    else if(['ttf','otf','woff','woff2'].includes(ext))fontFiles.push(f);
    else if(['png','jpg','jpeg','webp','gif','bmp','mp4','mov','m4v','webm','mp3','wav','m4a','ogg'].includes(ext))mediaFiles.push(f);
    else if(['json','ewtheme'].includes(ext))themeFiles.push(f);else ignored++;
  }
  let importedSongs=0,importedThemes=0,duplicates=0;
  for(const file of songFiles){
    try{
      const raw=await file.text(),parsed=decodeRtf(raw),data=splitImportedSongText(parsed.text,file.name.replace(/\.[^.]+$/,''));
      if(!data.sections.length)continue;
      if(songs.some(existing=>existing.title.trim().toLocaleLowerCase('it')===(data.title||file.name.replace(/\.[^.]+$/,'')).trim().toLocaleLowerCase('it'))){duplicates++;continue;}
      const themeId=uid('theme');
      const theme={id:themeId,name:`${data.title} · importato`,style:{...currentTheme().style,fontFamily:parsed.font||currentTheme().style.fontFamily,fontSize:parsed.fontSize||currentTheme().style.fontSize,color:parsed.color||currentTheme().style.color,fontWeight:parsed.bold?700:currentTheme().style.fontWeight,fontStyle:parsed.italic?'italic':'normal',textDecoration:parsed.underline?'underline':'none',bgMediaId:null}};
      await dbPut('themes',theme);themes.push(theme);
      const song={id:uid('song'),title:data.title||file.name.replace(/\.[^.]+$/,''),author:data.author||'Importato da EasyWorship',key:data.key||'',themeId,source:'EasyWorship',sourceFile:file.name,slides:data.sections.map(x=>({id:uid('slide'),section:x.section,text:x.text,importFormatting:{font:parsed.font,fontSize:parsed.fontSize,color:parsed.color,bold:parsed.bold,italic:parsed.italic,underline:parsed.underline}}))};
      await dbPut('songs',song);songs.push(song);importedSongs++;
    }catch(e){console.warn('Import canto fallito',file.name,e);}
  }
  for(const file of themeFiles){
    try{const obj=JSON.parse(await file.text());const src=obj.theme||obj;if(!src||typeof src!=='object')continue;
      const style=src.style||src.properties||src;
      const theme={id:uid('theme'),name:String(src.name||file.name.replace(/\.[^.]+$/,'')),style:{...currentTheme().style,backgroundColor:style.backgroundColor||style.background||currentTheme().style.backgroundColor,fontFamily:style.fontFamily||style.font||currentTheme().style.fontFamily,fontSize:Number(style.fontSize||style.size)||currentTheme().style.fontSize,color:style.color||style.textColor||currentTheme().style.color,align:style.align||currentTheme().style.align,overlay:Number(style.overlay??currentTheme().style.overlay),bgMediaId:null}};
      await dbPut('themes',theme);themes.push(theme);importedThemes++;
    }catch(e){console.info('Tema non JSON leggibile: sarà conservato solo se importato come file media.',file.name);ignored++;}
  }
  if(mediaFiles.length)await importMediaFiles(mediaFiles);
  if(fontFiles.length)await importFonts(fontFiles);
  await loadData();if(songs.length)selectedSongId=songs[songs.length-1].id;
  renderAll();setTab('canti');
  const sqliteNote=sqliteSummary?` Database SQLite: ${sqliteSummary.count} canti importati su ${sqliteSummary.total} record (${sqliteSummary.duplicates} duplicati saltati).`:'';
  toast(`Migrazione completata: ${importedSongs} file canto, ${importedThemes} temi JSON, ${mediaFiles.length} media, ${fontFiles.length} font.${duplicates?' Duplicati saltati: '+duplicates+'.':''}${ignored?' File non riconosciuti: '+ignored+'.':''}${sqliteNote}`);
}

function showBibleFormat() {
  alert('Formati import supportati:\n\nJSON: array di oggetti {"book":"Genesi","chapter":1,"verse":1,"text":"…","translation":"Nome versione"}. È accettato anche {"verses":[...]} .\n\nCSV: colonne book,chapter,verse,text,translation.\n\nTXT: una riga per versetto nel formato Genesi 1:1 | testo del versetto\n\nImporta soltanto traduzioni e testi per i quali disponi dei diritti o dell’autorizzazione d’uso.');
}
function parseCSV(text) {
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim()); if(!lines.length)return [];
  const parseLine=line=>{const out=[];let cell='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'&&quoted){cell+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){out.push(cell);cell='';}else cell+=c;}out.push(cell);return out;};
  const headers=parseLine(lines.shift()).map(x=>x.trim().toLowerCase());
  return lines.map(line=>{const values=parseLine(line);const row={};headers.forEach((h,i)=>row[h]=values[i]??'');return row;});
}
function normalizeVerse(row, defaultTranslation='Importata') {
  const book=String(row.book||row.libro||'').trim();const chapter=Number(row.chapter||row.capitolo);const verse=Number(row.verse||row.versetto);const text=String(row.text||row.testo||'').trim();
  if(!book||!Number.isInteger(chapter)||chapter<1||!Number.isInteger(verse)||verse<1||!text)return null;
  return {id:`${String(row.translation||row.traduzione||defaultTranslation)}|${book}|${chapter}|${verse}`,translation:String(row.translation||row.traduzione||defaultTranslation),book,chapter,verse,text};
}
async function importBibleFile(file) {
  try {
    const raw=await file.text();let rows=[];const ext=file.name.split('.').pop().toLowerCase();
    if(ext==='json'){const parsed=JSON.parse(raw);rows=Array.isArray(parsed)?parsed:(parsed.verses||parsed.versetti||[]);}
    else if(ext==='csv') rows=parseCSV(raw);
    else if(ext==='txt') rows=raw.split(/\r?\n/).map(line=>{const m=line.match(/^(.+?)\s+(\d+):(\d+)\s*\|\s*(.+)$/);return m?{book:m[1],chapter:m[2],verse:m[3],text:m[4]}:null;}).filter(Boolean);
    else throw new Error('Formato non supportato.');
    const verses=rows.map(x=>normalizeVerse(x,file.name.replace(/\.[^.]+$/,''))).filter(Boolean);
    if(!verses.length) throw new Error('Non sono stati riconosciuti versetti. Controlla il formato del file.');
    const tx=db.transaction('bibleVerses','readwrite');const store=tx.objectStore('bibleVerses');for(const v of verses)store.put(v);
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    bibleVerses=await dbGetAll('bibleVerses');renderAll();setTab('bibbia');toast(`${verses.length.toLocaleString('it-IT')} versetti importati/aggiornati.`);
  } catch(e) {console.error(e);toast(`Importazione Bibbia non riuscita: ${e.message}`,true);}
}
function blobToDataURL(blob) {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
function dataURLToBlob(data) {const [meta,b64]=data.split(',');const mime=(meta.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';const bin=atob(b64);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:mime});}
async function exportBackup() {
  toast('Preparazione backup: con molti video può richiedere memoria e tempo…');
  try {
    const backup={format:'WSP-BACKUP',version:1,createdAt:new Date().toISOString(),songs,services,themes,bibleVerses,settings:await dbGetAll('settings'),media:[]};
    for(const a of assets) {
      let blob=a.blob;
      if(!blob && window.wspDesktop){const response=await fetch(`/api/media/${encodeURIComponent(a.id)}`,{cache:'no-store'});if(!response.ok)throw new Error(`Media non trovato: ${a.name}`);blob=await response.blob();}
      if(!blob)throw new Error(`File non disponibile per il backup: ${a.name}`);
      const row={...a,blob:undefined,blobData:await blobToDataURL(blob)};backup.media.push(row);
    }
    const blob=new Blob([JSON.stringify(backup)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`WorshipStudioPro-backup-${new Date().toISOString().slice(0,10)}.wspbackup`;a.click();URL.revokeObjectURL(url);toast('Backup completo esportato.');
  } catch(e){console.error(e);toast('Backup non riuscito: memoria o spazio insufficienti.',true);}
}
async function importBackup(file) {
  try {
    const backup=JSON.parse(await file.text());if(backup.format!=='WSP-BACKUP')throw new Error('File di backup non riconosciuto.');
    if(!confirm('Il ripristino sostituirà i dati attuali nel database locale. Continuare?'))return;
    if(window.wspDesktop?.deleteMedia){for(const oldAsset of assets)await window.wspDesktop.deleteMedia(oldAsset.id).catch(()=>{});}
    for(const name of ['songs','services','themes','bibleVerses','settings','media'])await dbClear(name);
    for(const name of ['songs','services','themes','bibleVerses','settings'])for(const row of backup[name]||[])await dbPut(name,row);
    for(const row of backup.media||[]){const blob=dataURLToBlob(row.blobData);const copy={...row,blob:window.wspDesktop?null:blob};delete copy.blobData;if(window.wspDesktop?.saveMediaBytes){const bytes=await blob.arrayBuffer();await window.wspDesktop.saveMediaBytes({id:copy.id,name:copy.name,mime:copy.mime,kind:copy.kind,fontFamily:copy.fontFamily||'',bytes});}await dbPut('media',copy);}
    for(const url of objectUrls.values())URL.revokeObjectURL(url);objectUrls.clear();
    settings={};for(const row of await dbGetAll('settings'))settings[row.key]=row.value;
    applyAppearance(settings.appearanceMode||'dark');
    await loadData();activeServiceId=services[0]?.id||null;selectedSongId=songs[0]?.id||null;selectedSlideIndex=0;renderAll();toast('Backup ripristinato correttamente.');
  }catch(e){console.error(e);toast(`Ripristino non riuscito: ${e.message}`,true);}
}
async function refreshDisplayInfo() {
  try {
    if(window.wspDesktop) displayInfo=await window.wspDesktop.getInfo();
    else displayInfo={displays:[{id:'browser',name:'Finestra browser',width:window.screen.width,height:window.screen.height,primary:true}],outputUrl:new URL('./output.html', window.location.href).toString()};
  } catch(e){console.warn(e);}
  $('displayCount').textContent=displayInfo.displays.length?`${displayInfo.displays.length} rilevati`:'Non rilevati';
}
async function openOutput(displayId) {
  try {
    if(window.wspDesktop) await window.wspDesktop.openOutput(displayId);
    else window.open(displayInfo.outputUrl,'wsp-output','popup');
    setTimeout(broadcastLive,400);toast('Uscita LIVE aperta. Puoi aggiungere lo stesso URL in OBS.');
  } catch(e){toast(`Impossibile aprire il display: ${e.message}`,true);}
}

// OBS WebSocket v5 client without external dependencies.
function bytesToBase64(buffer) {let binary='';const bytes=new Uint8Array(buffer);for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);}
async function sha256Base64(text) {const bytes=new TextEncoder().encode(text);return bytesToBase64(await crypto.subtle.digest('SHA-256',bytes));}
class ObsWebSocketClient {
  constructor(){this.ws=null;this.pending=new Map();this.seq=0;this.connected=false;this.connectTimer=null;}
  connect(url,password) {
    return new Promise((resolve,reject)=>{
      try {this.ws=new WebSocket(url);} catch(e){reject(e);return;}
      this.connectTimer=setTimeout(()=>reject(new Error('Timeout di connessione OBS. Verifica host, porta e firewall.')),8000);
      this.ws.onmessage=async event=>{
        const msg=JSON.parse(event.data);
        if(msg.op===0){
          const d=msg.d||{};const identify={rpcVersion:1};
          if(d.authentication){if(!password){clearTimeout(this.connectTimer);reject(new Error('OBS richiede una password WebSocket.'));return;}const secret=await sha256Base64(password+d.authentication.salt);identify.authentication=await sha256Base64(secret+d.authentication.challenge);}
          this.ws.send(JSON.stringify({op:1,d:identify}));
        } else if(msg.op===2){this.connected=true;clearTimeout(this.connectTimer);resolve(msg.d);}
        else if(msg.op===7){const key=msg.d.requestId;const pending=this.pending.get(key);if(pending){this.pending.delete(key);if(msg.d.requestStatus?.result)pending.resolve(msg.d.responseData||{});else pending.reject(new Error(msg.d.requestStatus?.comment||'Richiesta OBS non riuscita.'));}}
        else if(msg.op===5){/* Eventi OBS disponibili per espansioni future. */}
      };
      this.ws.onerror=()=>{clearTimeout(this.connectTimer);reject(new Error('Connessione WebSocket rifiutata. Controlla che OBS sia aperto e il server sia abilitato.'));};
      this.ws.onclose=()=>{this.connected=false;obsConnected=false;for(const p of this.pending.values())p.reject(new Error('Connessione OBS interrotta.'));this.pending.clear();updateObsStatus('Connessione OBS interrotta.');};
    });
  }
  call(requestType,requestData={}) {
    if(!this.connected||!this.ws||this.ws.readyState!==WebSocket.OPEN)return Promise.reject(new Error('OBS non connesso.'));
    const requestId=`wsp-${++this.seq}`;
    return new Promise((resolve,reject)=>{this.pending.set(requestId,{resolve,reject});this.ws.send(JSON.stringify({op:6,d:{requestType,requestId,requestData}}));setTimeout(()=>{if(this.pending.has(requestId)){this.pending.delete(requestId);reject(new Error(`Timeout OBS: ${requestType}`));}},8000);});
  }
  disconnect(){try{this.ws?.close();}catch{}this.connected=false;}
}
async function connectOBS() {
  const host=$('obsHost')?.value.trim()||'127.0.0.1';const port=Number($('obsPort')?.value)||4455;const password=$('obsPassword')?.value||'';
  if(obsClient)obsClient.disconnect();obsClient=new ObsWebSocketClient();updateObsStatus('Connessione in corso…');
  try {await obsClient.connect(`ws://${host}:${port}`,password);obsConnected=true;$('obsPassword').value='';updateObsStatus('Connesso a OBS WebSocket.');$('obsQuickStatus').textContent='Connesso';toast('Connessione OBS riuscita.');}
  catch(e){obsConnected=false;updateObsStatus(e.message);$('obsQuickStatus').textContent='Non connesso';toast(e.message,true);}
}
function disconnectOBS(){obsClient?.disconnect();obsConnected=false;obsClient=null;updateObsStatus('Disconnesso da OBS.');$('obsQuickStatus').textContent='Non connesso';}
function updateObsStatus(message) {
  const el=$('obsStatus');if(el)el.textContent=message|| (obsConnected?'Connesso a OBS WebSocket.':'OBS WebSocket non connesso. In OBS Studio abilita Server WebSocket dalle impostazioni Strumenti → WebSocket Server.');
  if($('obsQuickStatus'))$('obsQuickStatus').textContent=obsConnected?'Connesso':'Non connesso';
}
async function createOBSSource() {
  if(!obsClient?.connected){toast('Collegati prima a OBS WebSocket.',true);return;}
  try {
    const scene=await obsClient.call('GetCurrentProgramScene');
    const sourceName='Worship Studio Pro LIVE';
    const obsUrl=$('outputUrl')?.value||displayInfo.outputUrl;
    const inputSettings={url:obsUrl,width:1920,height:1080,css:'body, #outputRoot { background: rgba(0,0,0,0) !important; margin: 0; overflow: hidden; }'};
    const inputs=await obsClient.call('GetInputList');
    const existing=(inputs.inputs||[]).find(x=>xinputName(x)===sourceName);
    if(existing) {
      await obsClient.call('SetInputSettings',{inputName:sourceName,inputSettings,overlay:true});
      let sceneItemId;
      try { const found=await obsClient.call('GetSceneItemId',{sceneName:scene.currentProgramSceneName,sourceName}); sceneItemId=found.sceneItemId; }
      catch { const created=await obsClient.call('CreateSceneItem',{sceneName:scene.currentProgramSceneName,sourceName,sceneItemEnabled:true}); sceneItemId=created.sceneItemId; }
      if(sceneItemId!==undefined) await obsClient.call('SetSceneItemEnabled',{sceneName:scene.currentProgramSceneName,sceneItemId,sceneItemEnabled:true});
    } else await obsClient.call('CreateInput',{sceneName:scene.currentProgramSceneName,inputName:sourceName,inputKind:'browser_source',inputSettings,sceneItemEnabled:true});
    updateObsStatus(`Sorgente “${sourceName}” pronta e visibile nella scena “${scene.currentProgramSceneName}”.`);toast('Browser Source pronto in OBS.');
  } catch(e){console.error(e);updateObsStatus(`Creazione sorgente OBS non riuscita: ${e.message}`);toast(`OBS: ${e.message}`,true);}
}
function xinputName(x){return x.inputName;}

// Event delegation for the app interface.
document.addEventListener('click',async event=>{
  if(!event.target.closest('.menu-group'))document.querySelectorAll('.menu-group[open]').forEach(m=>m.removeAttribute('open'));
  const tab=event.target.closest('[data-tab]');if(tab){setTab(tab.dataset.tab);if(tab.dataset.wordsView==='true'){wordsView=true;renderMainPanel();}if(tab.closest('.menu-dropdown'))document.querySelectorAll('.menu-group[open]').forEach(m=>m.removeAttribute('open'));return;}
  const actionEl=event.target.closest('[data-action]');if(actionEl){event.preventDefault();await handleAction(actionEl.dataset.action,actionEl);if(actionEl.closest('.menu-dropdown'))document.querySelectorAll('.menu-group[open]').forEach(m=>m.removeAttribute('open'));return;}
});
document.addEventListener('input',event=>{
  const id=event.target.id;
  if(id==='slideContent'){persistSlideText();return;}
  if(id==='pdfSongTitle'&&pdfImportedDraft)pdfImportedDraft.title=event.target.value;
  if(id==='pdfSongAuthor'&&pdfImportedDraft)pdfImportedDraft.author=event.target.value;
  if(id==='songFilter'){
    const q=event.target.value.toLocaleLowerCase('it');const list=$('songList');if(list)list.innerHTML=songs.filter(s=>s.title.toLocaleLowerCase('it').includes(q)).map(s=>`<button class="list-row ${s.id===selectedSongId?'active':''}" data-action="select-song" data-id="${escapeHTML(s.id)}"><span class="row-icon">♫</span><span class="row-main"><b>${escapeHTML(s.title)}</b><small>${escapeHTML(s.author||'Autore non indicato')}</small></span><span class="count">${s.slides?.length||0}</span></button>`).join('');
  }
  if(id==='bibleQuery')renderBibleResults();
  if(id==='themeSize')$('themeSizeValue').textContent=event.target.value+'px';
  if(id==='themeOverlay')$('themeOverlayValue').textContent=event.target.value+'%';
  if(id==='themeLineHeight')$('themeLineHeightValue').textContent=event.target.value;
});
document.addEventListener('change',async event=>{
  const id=event.target.id;
  if(id==='mediaPicker')await importMediaFiles([...event.target.files]);
  if(id==='fontPicker')await importFonts([...event.target.files]);
  if(id==='biblePicker'&&event.target.files[0])await importBibleFile(event.target.files[0]);
  if(id==='backupPicker'&&event.target.files[0])await importBackup(event.target.files[0]);
  if(id==='easyWorshipPicker'&&event.target.files.length)await importEasyWorshipFiles([...event.target.files]);
  if(id==='easyWorshipFolderPicker'&&event.target.files.length)await importEasyWorshipFiles([...event.target.files]);
  if(id==='pdfPicker'&&event.target.files[0])await extractPdf(event.target.files[0]);
  if(id==='bibleBook'){updateBibleChapterOptions();renderBibleResults();}
  if(id==='bibleTranslation'||id==='bibleChapter')renderBibleResults();
  if(id==='obsTransparent'){settings.obsTransparent=event.target.checked;await dbPut('settings',{key:'obsTransparent',value:settings.obsTransparent});const base=displayInfo.outputUrl||new URL('./output.html', window.location.href).toString();if($('outputUrl'))$('outputUrl').value=`${base}${base.includes('?')?'&':'?'}transparent=${settings.obsTransparent?'1':'0'}`;markSaved();}
  if(id==='themeChoose'){
    selectedThemeId=event.target.value;const song=currentSong();if(song){song.themeId=selectedThemeId;await dbPut('songs',song);}await dbPut('settings',{key:'activeThemeId',value:selectedThemeId});renderAll();setTab('temi');
  }
  if(id==='slideSection'){const song=songs.find(s=>s.id===selectedSongId);if(song?.slides[selectedSlideIndex]){song.slides[selectedSlideIndex].section=event.target.value;await dbPut('songs',song);renderAll();setTab('canti');}}
  if(id==='songTitle'||id==='songAuthor'||id==='songKey'||id==='songTheme'){
    const song=songs.find(s=>s.id===selectedSongId);if(song){song.title=$('songTitle')?.value||song.title;song.author=$('songAuthor')?.value||'';song.key=$('songKey')?.value||'';song.themeId=$('songTheme')?.value||song.themeId;await dbPut('songs',song);for(const s of services.filter(x=>x.songId===song.id)){s.title=song.title;await dbPut('services',s);}markSaved();renderPreview();}
  }
  if(id==='themeName'||id.startsWith('theme')){if(activeTab==='temi'&&id!=='themeChoose')await saveThemeFields();}
});
$('leftAdd').addEventListener('click',()=>{
  if(activeTab==='regia'||activeTab==='canti')addSong();
  else if(activeTab==='media')$('mediaPicker').click();
  else if(activeTab==='temi')newTheme();
});
$('previewEdit').addEventListener('click',async()=>{const content=currentContent();if(content.kind!=='text'){toast('Seleziona prima un contenuto testuale.');return;}if(!inlineEdit){inlineEdit=true;renderPreview();$('previewEdit').textContent='Fine modifica';$('previewText').focus();}else{inlineEdit=false;$('previewEdit').textContent='Modifica testo';await saveInlinePreviewText();renderPreview();}});
$('previewLive').addEventListener('click',()=>setLive('normal'));
$('goLive').addEventListener('click',()=>setLive(liveMode==='normal'?'idle':'normal'));
$('blackout').addEventListener('click',()=>setLive(liveMode==='black'?'normal':'black'));
$('clearLive').addEventListener('click',()=>setLive('blank'));
$('slidePrevious').addEventListener('click',()=>{selectedSlideIndex=Math.max(0,selectedSlideIndex-1);renderAll();});
$('slideNext').addEventListener('click',()=>{const song=currentSong();selectedSlideIndex=Math.min((song?.slides.length||1)-1,selectedSlideIndex+1);renderAll();});
document.addEventListener('keydown',event=>{
  const target=event.target;
  if(target?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
  const combo=event.ctrlKey&&event.altKey;
  if(combo&&event.key==='ArrowLeft'){event.preventDefault();selectedSlideIndex=Math.max(0,selectedSlideIndex-1);renderAll();updateLiveIfOnAir();return;}
  if(combo&&event.key==='ArrowRight'){event.preventDefault();const song=currentSong();selectedSlideIndex=Math.min((song?.slides.length||1)-1,selectedSlideIndex+1);renderAll();updateLiveIfOnAir();return;}
  if(combo&&event.key==='Enter'){event.preventDefault();setLive('normal');return;}
  if(combo&&event.key==='Backspace'){event.preventDefault();setLive('blank');return;}
  if(combo&&event.key.toLowerCase()==='b'){event.preventDefault();setLive('black');return;}
  if(combo&&event.key.toLowerCase()==='l'){event.preventDefault();runStreamDeckAction('logo');return;}
  if(event.key==='ArrowLeft'){event.preventDefault();selectedSlideIndex=Math.max(0,selectedSlideIndex-1);renderAll();}
  else if(event.key==='ArrowRight'){event.preventDefault();const song=currentSong();selectedSlideIndex=Math.min((song?.slides.length||1)-1,selectedSlideIndex+1);renderAll();}
  else if(event.code==='Space'&&!event.repeat){event.preventDefault();setLive(liveMode==='normal'?'idle':'normal');}
  else if(event.key==='Escape'&&liveMode!=='idle'){setLive('blank');}
});
$('duplicateSlide').addEventListener('click',async()=>{const song=currentSong();if(!song)return;const clone={...song.slides[selectedSlideIndex],id:uid('slide')};song.slides.splice(selectedSlideIndex+1,0,clone);selectedSlideIndex++;await dbPut('songs',song);renderAll();setTab('canti');});
$('deleteSlide').addEventListener('click',async()=>{const song=currentSong();if(!song||song.slides.length<=1)return;if(confirm('Eliminare la slide selezionata?')){song.slides.splice(selectedSlideIndex,1);selectedSlideIndex=Math.min(selectedSlideIndex,song.slides.length-1);await dbPut('songs',song);renderAll();setTab('canti');}});
$('renameService').addEventListener('click',async()=>{const name=prompt('Nome della celebrazione:',settings.serviceName||'Celebrazione principale');if(name?.trim()){settings.serviceName=name.trim();await dbPut('settings',{key:'serviceName',value:settings.serviceName});$('serviceName').textContent=settings.serviceName;markSaved();}});
$('fullscreenMain').addEventListener('click',()=>window.wspDesktop?.toggleMainFullscreen());
$('topDatabase').addEventListener('click',()=>setTab('database'));
$('mainPanel').addEventListener('input',event=>{if(event.target.id==='serviceTextEdit'){const s=currentService();if(s){s.text=event.target.value;dbPut('services',s);renderPreview();updateLiveIfOnAir();}}});

async function saveInlinePreviewText() {
  const text=$('previewText').innerText;
  const service=currentService();
  if(activeTab==='canti'){
    const song=songs.find(x=>x.id===selectedSongId);
    if(song?.slides[selectedSlideIndex]){song.slides[selectedSlideIndex].text=text;await dbPut('songs',song);}
  } else if(service?.type==='song'){
    const song=songs.find(x=>x.id===service.songId);
    if(song?.slides[selectedSlideIndex]){song.slides[selectedSlideIndex].text=text;await dbPut('songs',song);}
  } else if(service?.type==='scripture' || service?.type==='text') { service.text=text;await dbPut('services',service); }
  markSaved();updateLiveIfOnAir();
}
$('previewText').addEventListener('input',()=>{
  const service=currentService(), text=$('previewText').innerText;
  if(activeTab==='canti'){
    const song=songs.find(x=>x.id===selectedSongId);if(song?.slides[selectedSlideIndex]){song.slides[selectedSlideIndex].text=text;dbPut('songs',song);}
  } else if(service?.type==='song'){
    const song=songs.find(x=>x.id===service.songId);if(song?.slides[selectedSlideIndex]){song.slides[selectedSlideIndex].text=text;dbPut('songs',song);}
  } else if(service?.type==='scripture' || service?.type==='text') {service.text=text;dbPut('services',service);}
  if(liveMode==='normal') {livePayload=buildPayload('normal');broadcastLive();renderLivePanel();}
});
$('previewText').addEventListener('blur',async()=>{if(inlineEdit)await saveInlinePreviewText();});
document.addEventListener('click',event=>{if(event.target.closest('#previewEditText'))$('previewEdit').click();});
$('previewCanvas').addEventListener('dragover',event=>{event.preventDefault();$('previewCanvas').classList.add('drop-target');});
$('previewCanvas').addEventListener('dragleave',()=> $('previewCanvas').classList.remove('drop-target'));
$('previewCanvas').addEventListener('drop',async event=>{event.preventDefault();$('previewCanvas').classList.remove('drop-target');const files=[...(event.dataTransfer?.files||[])];if(files.length)await importMediaFiles(files,true);});

async function requestPersistentStorage() {
  try { if(navigator.storage?.persist) {const ok=await navigator.storage.persist();if(!ok)console.warn('Storage persist non concesso dal browser.');} } catch(e){console.warn(e);}
}
async function boot() {
  try {
    db=await openDatabase();await seedDatabase();
    settings={};for(const row of await dbGetAll('settings'))settings[row.key]=row.value;
    applyAppearance(settings.appearanceMode||'dark');
    await loadData();await refreshDisplayInfo();
    if(channel) channel.onmessage=event=>{if(event.data?.type==='REQUEST_STATE')broadcastLive();};
    if(navigator.storage?.estimate){const estimate=await navigator.storage.estimate();console.info('Quota archivio locale',estimate);}
    await requestPersistentStorage();await loadStreamDeckInfo();renderAll();setTab('regia');
    if(window.wspDesktop){streamDeckPollTimer=setInterval(pollStreamDeckCommands,300);}
  } catch(e) {console.error(e);toast(`Errore apertura database: ${e.message}`,true);}
}
window.addEventListener('beforeunload',()=>{for(const url of objectUrls.values())URL.revokeObjectURL(url);channel?.close();});
window.WorshipStudioPro={getCurrentContent:currentContent,sendLive:()=>setLive('normal'),databaseName:DB_NAME};
boot();
