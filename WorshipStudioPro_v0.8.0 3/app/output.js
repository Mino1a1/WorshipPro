'use strict';
const DB_NAME='WorshipStudioProLocal', CHANNEL_NAME='wsp-live-output-v1';
const channel=('BroadcastChannel' in window)?new BroadcastChannel(CHANNEL_NAME):null;
const $=id=>document.getElementById(id);
let db, state={mode:'idle'}, urls=new Map(), fontsLoaded=new Set(), fontListCache=null;
const transparentOutput=new URLSearchParams(location.search).get('transparent')==='1';
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('songs'))d.createObjectStore('songs',{keyPath:'id'});if(!d.objectStoreNames.contains('services'))d.createObjectStore('services',{keyPath:'id'});if(!d.objectStoreNames.contains('media'))d.createObjectStore('media',{keyPath:'id'});if(!d.objectStoreNames.contains('themes'))d.createObjectStore('themes',{keyPath:'id'});if(!d.objectStoreNames.contains('bibleVerses'))d.createObjectStore('bibleVerses',{keyPath:'id'});if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function getAsset(id){
  // Fetch only metadata; the media itself is streamed by the local HTTP server (supports Range requests).
  try {const response=await fetch(`/api/media-meta/${encodeURIComponent(id)}`,{cache:'no-store'});if(response.ok){const meta=await response.json();return {...meta,streamUrl:`/api/media/${encodeURIComponent(id)}`};}} catch(e) {}
  return new Promise((resolve,reject)=>{if(!db){reject(new Error('Database output non disponibile'));return;}const tx=db.transaction('media','readonly');const r=tx.objectStore('media').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
async function urlFor(asset){if(!asset)return null;if(asset.streamUrl)return asset.streamUrl;if(urls.has(asset.id))return urls.get(asset.id);const url=URL.createObjectURL(asset.blob);urls.set(asset.id,url);return url;}
async function loadFont(asset){if(!asset||fontsLoaded.has(asset.id))return;try{const url=await urlFor(asset);const family=asset.fontFamily||asset.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ');const face=new FontFace(family,`url(${url})`);await face.load();document.fonts.add(face);fontsLoaded.add(asset.id);}catch(e){console.warn('Font LIVE non disponibile',e);}}
async function ensureOutputFont(family){
  try {if(!fontListCache){const r=await fetch('/api/fonts',{cache:'no-store'});fontListCache=r.ok?await r.json():[];}const match=fontListCache.find(x=>(x.fontFamily||x.name?.replace(/\.[^.]+$/,''))===family);if(match){await loadFont({...match,streamUrl:`/api/media/${encodeURIComponent(match.id)}`});return;}}catch(e){}
  if(db){try{const fonts=await new Promise((resolve,reject)=>{const tx=db.transaction('media','readonly');const r=tx.objectStore('media').getAll();r.onsuccess=()=>resolve(r.result.filter(x=>x.kind==='font'));r.onerror=()=>reject(r.error);});const f=fonts.find(x=>(x.fontFamily||x.name.replace(/\.[^.]+$/,''))===family);if(f)await loadFont(f);}catch(e){console.warn(e);}}
}
async function showMedia(asset, container, role){
  if(!asset)return;
  const url=await urlFor(asset);if(!container.isConnected)return;
  if(asset.kind==='image'){
    const img=document.createElement('img');img.src=url;img.alt='';img.className='output-image';container.appendChild(img);
  } else if(asset.kind==='video'){
    const video=document.createElement('video');video.src=url;video.autoplay=true;video.loop=role==='background';video.playsInline=true;video.preload='auto';video.muted=role==='background';video.className='output-video';video.controls=false;container.appendChild(video);video.play().catch(()=>{});
  } else if(asset.kind==='audio'){
    const audio=document.createElement('audio');audio.src=url;audio.autoplay=true;audio.loop=false;audio.controls=false;audio.className='output-audio';container.appendChild(audio);audio.play().catch(()=>{});
  }
}
async function render(next){
  state=next||{mode:'idle'};const root=$('outputRoot'),background=$('outputBackground'),overlay=$('outputOverlay'),text=$('outputText'),caption=$('outputCaption');
  root.classList.toggle('transparent-mode',transparentOutput);document.body.classList.toggle('transparent-mode',transparentOutput);
  background.innerHTML='';background.style.backgroundImage='none';text.textContent='';caption.textContent='';root.classList.remove('black','blank');
  if(state.mode==='black'){root.style.backgroundColor='#000';root.classList.add('black');return;}
  if(state.mode==='blank'||state.mode==='idle'){root.style.backgroundColor=transparentOutput?'transparent':'#000';root.classList.add('blank');text.textContent=state.mode==='idle'?'':' ';return;}
  const payload=state.content||{};const style=state.style||{};
  root.style.backgroundColor=transparentOutput?'transparent':(style.backgroundColor||'#111827');
  overlay.style.opacity=transparentOutput?'0':String(Math.max(0,Math.min(90,Number(style.overlay)||0))/100);overlay.style.background='#000';
  const bgId=(transparentOutput||payload.kind==='media')?null:style.bgMediaId;
  if(bgId){try{const bg=await getAsset(bgId);await showMedia(bg,background,'background');}catch(e){console.error(e);}}
  if(payload.kind==='media'&&payload.mediaId){try{const a=await getAsset(payload.mediaId);await showMedia(a,background,'main');}catch(e){console.error(e);}}
  if(payload.kind==='text')text.textContent=payload.text||'';
  if(payload.kind==='media'){
    const media=await getAsset(payload.mediaId).catch(()=>null);
    if(media?.kind==='audio')text.textContent=`♫ ${media.name}`;
  }
  const family=style.fontFamily||'Arial';
  if(family&&!['Arial','Arial Black','Aptos','Calibri','Cambria','Candara','Comic Sans MS','Consolas','Courier New','Georgia','Garamond','Impact','Lucida Console','Palatino Linotype','Segoe UI','Tahoma','Times New Roman','Trebuchet MS','Verdana','system-ui','serif','sans-serif'].includes(family)) await ensureOutputFont(family);
  text.style.fontFamily=family;text.style.fontSize=`${Math.max(12,Number(style.fontSize)||42)}px`;text.style.fontWeight=style.fontWeight||700;text.style.fontStyle=style.fontStyle||'normal';text.style.textDecoration=style.textDecoration||'none';text.style.color=style.color||'#fff';text.style.textAlign=style.align||'center';text.style.letterSpacing=`${Number(style.letterSpacing)||0}px`;text.style.lineHeight=style.lineHeight||1.35;text.style.textShadow=style.shadow===false?'none':'0 2px 18px #000b';
  root.style.alignItems=style.position==='top'?'flex-start':style.position==='bottom'?'flex-end':'center';text.style.marginTop=style.position==='top'?'6%':'0';text.style.marginBottom=style.position==='bottom'?'6%':'0';
  caption.textContent=payload.reference||payload.title||'';
}
(async()=>{
  try{db=await openDB();}catch(e){console.error('Database output non disponibile',e);}
  if(channel){channel.onmessage=event=>{if(event.data?.type==='LIVE_STATE')render(event.data.state);};channel.postMessage({type:'REQUEST_STATE'});}
  // Poll the localhost state endpoint: OBS Browser Source may not share Electron's BroadcastChannel partition.
  let lastUpdatedAt=-1;
  const poll=async()=>{try{const r=await fetch(`/api/live-state?t=${Date.now()}`,{cache:'no-store'});if(r.ok){const next=await r.json();const stamp=Number(next.updatedAt)||0;if(stamp!==lastUpdatedAt||next.mode!==state.mode){lastUpdatedAt=stamp;render(next);}}}catch(e){}};
  poll();setInterval(poll,250);
  setTimeout(()=>{if(state.mode==='idle'&&channel)channel.postMessage({type:'REQUEST_STATE'});},700);
})();
window.addEventListener('beforeunload',()=>{for(const u of urls.values())URL.revokeObjectURL(u);channel?.close();});
