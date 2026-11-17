$ErrorActionPreference = 'Stop'

Write-Host 'Worship Studio Pro - build Windows 11' -ForegroundColor Cyan

if (-not $IsWindows -and $env:OS -ne 'Windows_NT') {
  throw 'Questo script deve essere eseguito su Windows 11.'
}

$node = (node --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Node.js non trovato. Installa Node.js 24 LTS.' }
$major = [int]($node.TrimStart('v').Split('.')[0])
if ($major -lt 24) { throw "È richiesto Node.js 24 o superiore. Versione rilevata: $node" }

Write-Host "Node.js $node rilevato. Installazione dipendenze..."
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Installazione dipendenze non riuscita.' }

Write-Host 'Controllo sintassi...'
node --check app/app.js
if ($LASTEXITCODE -ne 0) { throw 'Errore di sintassi in app/app.js.' }
node --check electron/main.cjs
if ($LASTEXITCODE -ne 0) { throw 'Errore di sintassi in electron/main.cjs.' }
node --check electron/preload.cjs
if ($LASTEXITCODE -ne 0) { throw 'Errore di sintassi in electron/preload.cjs.' }
node --check electron/easyworship-import.cjs
if ($LASTEXITCODE -ne 0) { throw 'Errore di sintassi in electron/easyworship-import.cjs.' }

Write-Host 'Esecuzione test automatici...'
npm test
if ($LASTEXITCODE -ne 0) { throw 'I test automatici non sono passati. Build interrotta.' }

Write-Host 'Creazione installer Windows (NSIS)...'
npm run package:win
if ($LASTEXITCODE -ne 0) { throw 'Creazione installer non riuscita.' }

$installer = Get-ChildItem -Path 'release' -Filter '*.exe' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) { throw 'Build terminata ma non è stato trovato alcun installer .exe nella cartella release.' }
Write-Host "Installer creato: $($installer.FullName)" -ForegroundColor Green
