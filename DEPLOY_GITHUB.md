# Deploy GitHub e build installer Windows — Worship Studio Pro v0.8.0

## Struttura richiesta

Il contenuto di questa cartella deve stare direttamente nella radice del repository `Mino1a1/WorshipPro`. Non caricare la cartella `1_CARICA_SU_GITHUB` come sottocartella. La struttura deve mostrare immediatamente `app/`, `electron/`, `test/`, `package.json` e `.github/`.

## Anteprima GitHub Pages

1. Apri il repository su GitHub e vai in **Settings → Pages**.
2. In **Build and deployment → Source**, seleziona **GitHub Actions**.
3. Fai un commit/push sul branch `main`.
4. Apri **Actions** e controlla il workflow **Deploy preview to GitHub Pages**.
5. Al completamento, l’URL è `https://mino1a1.github.io/WorshipPro/`.

Il workflow prende `app/` come sorgente, controlla che `index.html`, `styles.css` e `app.js` esistano e crea l’artefatto del sito. `nr94.json` viene escluso dalla pubblicazione Pages.

## Build automatica Windows

Il workflow **Test and build Worship Studio Pro for Windows** parte a ogni push su `main`, sulle Pull Request verso `main` e al push di tag `v*`. Esegue i controlli JavaScript, `npm test` e `npm run package:win`, quindi carica il file `.exe` negli artefatti della run.

Per creare una Release GitHub, da una copia locale del repository esegui:

```powershell
git tag v0.8.0
git push origin v0.8.0
```

La run associata al tag allega l’installer `.exe` alla Release.

## Build locale con il contenuto Bibbia fornito separatamente

Nello ZIP completo, la cartella `2_CONTENUTI_LOCALI_PRIVATI_NON_CARICARE_SU_GITHUB` contiene il file derivato dal PDB. Lascia questa cartella accanto a `1_CARICA_SU_GITHUB`, non spostarla nel repository. Avvia PowerShell nella cartella di progetto e lancia:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\build-windows.ps1
```

Lo script copia il file Bibbia in `app/nr94.json`, che è escluso da `.gitignore`, quindi installa le dipendenze, verifica la sintassi, esegue i test e crea l’installer in `release/`.

La build Windows eseguita su GitHub Actions non contiene il file Bibbia privato, perché quel file non è caricato nel repository; l’applicazione mantiene comunque la funzione di importazione Bibbia. Per distribuire il testo integrale tramite GitHub, prima verifica e ottieni i diritti necessari.

## Note operative

- GitHub Pages non esegue Electron: è una demo browser.
- Le finestre fullscreen su monitor esterno, il server API locale per OBS WebSocket e i comandi VSD N3 funzionano nell’app desktop.
- Le macro VSD N3 documentate sono scorciatoie da tastiera: in questa versione l’app deve essere in primo piano. Non è un plugin VSD nativo e non offre feedback dinamico bidirezionale.
- L’installer non è firmato digitalmente: SmartScreen può mostrare un avviso.
- Testa il proiettore, OBS e VSD N3 sul PC e sugli apparati reali prima dell’uso in diretta.
