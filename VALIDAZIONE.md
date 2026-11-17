# Validazione Worship Studio Pro v0.8.0 — pacchetto GitHub

## Controlli eseguiti in ambiente disponibile

- `npm test` con Node.js 22.16.0: 11 test superati, 0 falliti.
- Verifica sintassi di `app/app.js`, `app/output.js`, `electron/main.cjs`, `electron/preload.cjs` ed `electron/easyworship-import.cjs`.
- Verifica di percorsi relativi per CSS/JS/output e URL della pagina sotto il percorso GitHub Pages `/WorshipPro/`.
- Verifica che il workflow Pages pubblichi soltanto `app/` e rimuova `nr94.json` dall'artefatto pubblico.

## Non certificato in questa sessione

- Build finale NSIS `.exe`: non eseguita, perché l'ambiente disponibile usa Node.js 22.16.0, mentre il progetto richiede Node.js 24 o superiore e non è Windows 11.
- Installazione ed esecuzione su Windows 11 reale.
- Test fisici con secondo monitor/proiettore, OBS Studio e VSD N3.
- Verifica dell'avvenuta pubblicazione su GitHub Pages: il collegamento GitHub disponibile non ha permessi di scrittura sul repository.

I workflow GitHub eseguono i controlli e la build nel runner Windows dopo il caricamento. Il successo della build non sostituisce il collaudo con l'hardware effettivo.
