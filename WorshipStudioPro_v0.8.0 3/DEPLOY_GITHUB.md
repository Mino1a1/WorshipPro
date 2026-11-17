# Deploy GitHub e build installer Windows

## Requisiti
- Windows 11 per la build locale.
- Node.js 24 o superiore e npm.
- Git.

## Build locale
Aprire PowerShell nella cartella principale del progetto ed eseguire:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\build-windows.ps1
```

Lo script installa le dipendenze, controlla la sintassi, esegue i test e genera l'installer NSIS `.exe` in `release/`.

In alternativa, manualmente:

```powershell
npm install --no-audit --no-fund
npm test
npm run package:win
```

## GitHub Actions
1. Creare un repository GitHub vuoto.
2. Estrarre il pacchetto e aprire PowerShell nella cartella principale.
3. Eseguire:

```powershell
git init
git add .
git commit -m "Worship Studio Pro v0.8.0"
git branch -M main
git remote add origin https://github.com/UTENTE/Worship-Studio-Pro.git
git push -u origin main
```

4. Aprire la scheda **Actions** del repository. Il workflow `.github/workflows/windows-build.yml` esegue i controlli su Windows e carica l'installer come artifact.
5. Per pubblicare una Release, creare e inviare un tag:

```powershell
git tag v0.8.0
git push origin v0.8.0
```

Il workflow allega il file `.exe` alla GitHub Release associata al tag.

## Proiettore, OBS e VSD N3
Consultare `COLLAUDO_WINDOWS11.md` prima dell'uso dal vivo. Le macro VSD N3 richiedono che Worship Studio Pro sia in primo piano. OBS WebSocket e la Browser Source devono essere verificati sullo stesso PC.

## Note di distribuzione
- Il file `.exe` non è firmato digitalmente: Windows SmartScreen può mostrare un avviso per un'app non riconosciuta. La firma richiede un certificato di code signing.
- GitHub Actions produce un installer Windows, ma il successo della build non certifica la compatibilità con ogni GPU, proiettore, driver, OBS o dispositivo VSD N3.
- Verificare i diritti di distribuzione di tutti i testi, font, immagini e media inclusi nel progetto prima di rendere pubblico il repository o la Release.
