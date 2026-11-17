const { app, BrowserWindow, ipcMain, screen } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let server;
let serverPort;
let mainWindow;
let outputWindow;
let liveState = { mode: 'idle', updatedAt: 0 };
let mediaRoot;
let streamDeckToken;
const streamDeckCommands = [];

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon'
};

function startLocalServer() {
  const root = path.join(app.getAppPath(), 'app');
  const allowed = new Set(['index.html', 'output.html', 'app.js', 'output.js', 'styles.css', 'nr94.json']);
  mediaRoot = path.join(app.getPath('userData'), 'media');
  const tokenFile = path.join(app.getPath('userData'), 'streamdeck-token.txt');
  try { streamDeckToken = fs.readFileSync(tokenFile, 'utf8').trim(); } catch {}
  if (!streamDeckToken || streamDeckToken.length < 32) {
    streamDeckToken = crypto.randomBytes(24).toString('hex');
    try { fs.writeFileSync(tokenFile, streamDeckToken, { mode: 0o600 }); } catch (e) { console.warn('Token Stream Deck non salvato', e); }
  }
  fs.mkdirSync(mediaRoot, { recursive: true });
  server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

      if (urlPath.startsWith('/api/streamdeck/')) {
        const parsed = new URL(req.url || '/', 'http://127.0.0.1');
        const token = parsed.searchParams.get('token') || '';
        if (!streamDeckToken || token.length !== streamDeckToken.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(streamDeckToken))) {
          res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Unauthorized'); return;
        }
        const action = urlPath.slice('/api/streamdeck/'.length);
        if (req.method !== 'GET') { res.writeHead(405); res.end('Method not allowed'); return; }
        if (action === 'info') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ token: streamDeckToken, baseUrl: `http://127.0.0.1:${serverPort}`, actions: ['previous','next','live','clear','black','logo','open-app'] })); return;
        }
        if (action === 'commands') {
          const commands = streamDeckCommands.splice(0, streamDeckCommands.length);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ commands })); return;
        }
        const allowed = new Set(['previous','next','live','clear','black','logo','open-app']);
        if (!allowed.has(action)) { res.writeHead(404); res.end('Unknown action'); return; }
        if (action === 'open-app') {
          if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
        } else {
          if (streamDeckCommands.length < 100) streamDeckCommands.push({ action, at: Date.now() });
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ ok: true, action })); return;
      }

      if (urlPath === '/api/live-state') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify(liveState)); return;
        }
        if (req.method === 'POST') {
          let body = ''; let tooLarge = false;
          req.on('data', chunk => { body += chunk; if (body.length > 1024 * 1024) tooLarge = true; });
          req.on('end', () => {
            if (tooLarge) { res.writeHead(413); res.end('Payload too large'); return; }
            try { liveState = JSON.parse(body); res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end(); }
            catch { res.writeHead(400); res.end('Invalid JSON'); }
          });
          return;
        }
        res.writeHead(405); res.end('Method not allowed'); return;
      }
      if (urlPath === '/api/fonts') {
        if (req.method !== 'GET') { res.writeHead(405); res.end('Method not allowed'); return; }
        const files = (await fs.promises.readdir(mediaRoot)).filter(x => x.endsWith('.json'));
        const fonts = [];
        for (const file of files) {
          try { const meta = JSON.parse(await fs.promises.readFile(path.join(mediaRoot, file), 'utf8')); if (meta.kind === 'font') fonts.push({ id: file.slice(0, -5), name: meta.name, fontFamily: meta.fontFamily }); } catch {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(fonts)); return;
      }
      if (urlPath.startsWith('/api/media-meta/')) {
        if (req.method !== 'GET') { res.writeHead(405); res.end('Method not allowed'); return; }
        const id = urlPath.slice('/api/media-meta/'.length);
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) { res.writeHead(400); res.end('Invalid media id'); return; }
        const meta = JSON.parse(await fs.promises.readFile(path.join(mediaRoot, `${id}.json`), 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ id, name: meta.name, mime: meta.mime, kind: meta.kind, fontFamily: meta.fontFamily })); return;
      }
      if (urlPath.startsWith('/api/media/')) {
        if (req.method !== 'GET') { res.writeHead(405); res.end('Method not allowed'); return; }
        const id = urlPath.slice('/api/media/'.length);
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) { res.writeHead(400); res.end('Invalid media id'); return; }
        const metaPath = path.join(mediaRoot, `${id}.json`);
        const dataPath = path.join(mediaRoot, `${id}.bin`);
        const [metaRaw, stat] = await Promise.all([fs.promises.readFile(metaPath, 'utf8'), fs.promises.stat(dataPath)]);
        const meta = JSON.parse(metaRaw);
        const headers = { 'Content-Type': meta.mime || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-WSP-Kind': meta.kind || 'media', 'X-WSP-Name': encodeURIComponent(meta.name || id), 'X-WSP-Font-Family': encodeURIComponent(meta.fontFamily || '') };
        const range = req.headers.range;
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!match) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); res.end(); return; }
          const start = match[1] ? Number(match[1]) : 0;
          const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
          if (start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); res.end(); return; }
          res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}` });
          fs.createReadStream(dataPath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, { ...headers, 'Content-Length': stat.size });
          fs.createReadStream(dataPath).pipe(res);
        }
        return;
      }
      const name = urlPath === '/' ? 'index.html' : path.basename(urlPath);
      if (!allowed.has(name)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
      const file = path.join(root, name);
      const data = await fs.promises.readFile(file);
      res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(data);
    } catch (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Local server error');
    }
  });
  return new Promise((resolve, reject) => {
    // Keep a stable localhost origin so IndexedDB persists between app launches.
    const portFile = path.join(app.getPath('userData'), 'local-server-port.txt');
    let preferredPort = 38471;
    try { const saved = Number(fs.readFileSync(portFile, 'utf8').trim()); if (saved > 1024 && saved < 65536) preferredPort = saved; } catch {}
    server.once('error', reject);
    server.listen(preferredPort, '127.0.0.1', () => {
      serverPort = server.address().port;
      try { fs.writeFileSync(portFile, String(serverPort), 'utf8'); } catch (e) { console.warn('Impossibile memorizzare la porta locale', e); }
      resolve(`http://127.0.0.1:${serverPort}`);
    });
  });
}
function getDisplayList() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((d, index) => ({
    id: d.id,
    name: d.id === primary.id ? `Schermo ${index + 1} (principale)` : `Schermo ${index + 1} (esterno)`,
    width: d.size.width,
    height: d.size.height,
    primary: d.id === primary.id,
    bounds: d.bounds
  }));
}

function openOutput(displayId) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  let display = displays.find(d => String(d.id) === String(displayId));
  if (!display) display = displays.find(d => d.id !== primary.id) || primary;
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.setFullScreen(false);
    outputWindow.setBounds(display.bounds);
    outputWindow.setFullScreen(true);
    outputWindow.show();
    outputWindow.focus();
    return { ok: true, reused: true };
  }
  outputWindow = new BrowserWindow({
    x: display.bounds.x, y: display.bounds.y,
    width: display.bounds.width, height: display.bounds.height,
    show: true, frame: false, fullscreen: true, autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  outputWindow.loadURL(`http://127.0.0.1:${serverPort}/output.html`);
  outputWindow.on('closed', () => { outputWindow = null; });
  return { ok: true, reused: false };
}

ipcMain.handle('streamdeck:get-info', () => ({ token: streamDeckToken, baseUrl: `http://127.0.0.1:${serverPort}` }));
ipcMain.handle('desktop:get-info', () => ({
  displays: getDisplayList(),
  outputUrl: `http://127.0.0.1:${serverPort}/output.html`,
  appVersion: app.getVersion()
}));
ipcMain.handle('desktop:open-output', (_event, displayId) => openOutput(displayId));
ipcMain.handle('desktop:close-output', () => {
  if (outputWindow && !outputWindow.isDestroyed()) outputWindow.close();
  outputWindow = null;
  return { ok: true };
});

ipcMain.handle('media:save-file', async (_event, payload) => {
  const { id, name, mime, kind, fontFamily, filePath } = payload || {};
  if (!/^[a-zA-Z0-9_-]+$/.test(String(id || '')) || typeof filePath !== 'string' || !path.isAbsolute(filePath)) throw new Error('Percorso media non valido.');
  const target = path.join(mediaRoot, `${id}.bin`);
  await fs.promises.copyFile(filePath, target);
  await fs.promises.writeFile(path.join(mediaRoot, `${id}.json`), JSON.stringify({ name: String(name || id), mime: String(mime || 'application/octet-stream'), kind: String(kind || 'media'), fontFamily: String(fontFamily || '') }), 'utf8');
  return { ok: true };
});
ipcMain.handle('media:save-bytes', async (_event, payload) => {
  const { id, name, mime, kind, fontFamily, bytes } = payload || {};
  if (!/^[a-zA-Z0-9_-]+$/.test(String(id || '')) || !(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) throw new Error('Dati media non validi.');
  const target = path.join(mediaRoot, `${id}.bin`);
  await fs.promises.writeFile(target, Buffer.from(bytes));
  await fs.promises.writeFile(path.join(mediaRoot, `${id}.json`), JSON.stringify({ name: String(name || id), mime: String(mime || 'application/octet-stream'), kind: String(kind || 'media'), fontFamily: String(fontFamily || '') }), 'utf8');
  return { ok: true };
});
ipcMain.handle('media:delete', async (_event, id) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(id || ''))) return { ok: false };
  await Promise.all([fs.promises.rm(path.join(mediaRoot, `${id}.bin`), { force: true }), fs.promises.rm(path.join(mediaRoot, `${id}.json`), { force: true })]);
  return { ok: true };
});


ipcMain.handle('pdf:extract-text', async (_event, filePath, forceOcr = false) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath) || path.extname(filePath).toLowerCase() !== '.pdf') throw new Error('File PDF non valido.');
  const stat = await fs.promises.stat(filePath);
  if (stat.size > 80 * 1024 * 1024) throw new Error('PDF oltre il limite di 80 MB.');
  const buffer = await fs.promises.readFile(filePath);
  let parsed = { text: '', numpages: 0, info: {} };
  if (!forceOcr) {
    const pdfParse = require('pdf-parse');
    parsed = await pdfParse(buffer);
    if ((parsed.text || '').replace(/\s/g, '').length > 40) return { text: parsed.text, pages: parsed.numpages || 0, info: parsed.info || {}, method: 'text' };
  }
  // OCR fallback for scanned/image-only PDFs. Pages are rendered locally; no document is uploaded.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = require('@napi-rs/canvas');
  const { createWorker } = require('tesseract.js');
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  if (pdf.numPages > 60) throw new Error('Per OCR il limite è 60 pagine per documento.');
  const pageCount = pdf.numPages;
  const worker = await createWorker('ita+eng');
  const pages = [];
  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas.toBuffer('image/png'));
      pages.push(`\n--- PAGINA ${pageNo} ---\n${result.data.text || ''}`);
      page.cleanup();
    }
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }
  const ocrText = pages.join('\n').trim();
  return { text: ocrText, pages: pageCount || parsed.numpages || 0, info: parsed.info || {}, method: 'ocr' };
});

ipcMain.handle('easyworship:read-database', async (_event, payload) => {
  const { readEasyWorshipDatabase } = require('./easyworship-import.cjs');
  return readEasyWorshipDatabase(payload?.songsDbPath, payload?.songWordsDbPath);
});

ipcMain.handle('desktop:fullscreen-main', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return { ok: true };
});

app.whenReady().then(async () => {
  const baseUrl = await startLocalServer();
  mainWindow = new BrowserWindow({
    width: 1640, height: 1020, minWidth: 1120, minHeight: 720,
    backgroundColor: '#10131a', title: 'Worship Studio Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  await mainWindow.loadURL(baseUrl);
  mainWindow.on('closed', () => { mainWindow = null; });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = new BrowserWindow({ width: 1640, height: 1020, minWidth: 1120, minHeight: 720, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
      mainWindow.loadURL(baseUrl);
    }
  });
}).catch(err => { console.error('Avvio Worship Studio Pro fallito:', err); app.quit(); });

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
