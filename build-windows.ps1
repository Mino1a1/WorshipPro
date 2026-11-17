$ErrorActionPreference = 'Stop'

Write-Host 'Worship Studio Pro v0.8.0 - build installer Windows 11' -ForegroundColor Cyan

if ($env:OS -ne 'Windows_NT') {
  throw 'Questo script deve essere eseguito su Windows 11.'
}

$node = (node --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Node.js non trovato. Installa Node.js 24 LTS.' }
$major = [int]($node.TrimStart('v').Split('.')[0])
if ($major -lt 24) { throw "È richiesto Node.js 24 o superiore. Versione rilevata: $node" }

# The PDB-derived Bible file is supplied separately and must not be uploaded to a public repository.
$packageRoot = Split-Path -Parent $PSScriptRoot
$privateBible = Join-Path $packageRoot '2_CONTENUTI_LOCALI_PRIVATI_NON_CARICARE_SU_GITHUB\nr94.json'
$localBible = Join-Path $PSScriptRoot 'app\nr94.json'
if (Test-Path -LiteralPath $privateBible) {
  Copy-Item -LiteralPath $privateBible -Destination $localBible -Force
  Write-Host 'Contenuto Bibbia locale trovato: sarà incluso nell’installer locale.' -ForegroundColor Yellow
} elseif (Test-Path -LiteralPath $localBible) {
  Write-Host 'File Bibbia locale già presente in app: sarà incluso nell’installer.' -ForegroundColor Yellow
} else {
  Write-Host 'Nessun contenuto Bibbia incorporato: potrai importare una traduzione autorizzata dall’app.' -ForegroundColor Yellow
}

Write-Host "Node.js $node rilevato. Installazione dipendenze..."
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Installazione dipendenze non riuscita.' }

Write-Host 'Controllo sintassi...'
$syntaxFiles = @('app/app.js','app/output.js','electron/main.cjs','electron/preload.cjs','electron/easyworship-import.cjs')
foreach ($file in $syntaxFiles) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Errore di sintassi in $file." }
}

Write-Host 'Esecuzione test automatici...'
npm test
if ($LASTEXITCODE -ne 0) { throw 'I test automatici non sono passati. Build interrotta.' }

Write-Host 'Creazione installer Windows (NSIS)...'
npm run package:win
if ($LASTEXITCODE -ne 0) { throw 'Creazione installer non riuscita.' }

$installer = Get-ChildItem -Path 'release' -Filter '*.exe' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) { throw 'Build terminata ma non è stato trovato alcun installer .exe nella cartella release.' }
Write-Host "Installer creato: $($installer.FullName)" -ForegroundColor Green
