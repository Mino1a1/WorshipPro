# Validazione Worship Studio Pro 0.8.0

## Verifiche eseguite
- `node --check app/app.js` — superato.
- `node --check electron/main.cjs` — superato.
- `npm test` — 7 test superati, 0 falliti.
- Verifica JSON `package.json` — superata.
- Verifica integrità archivio ZIP — eseguita dopo la creazione.

## Nuove verifiche automatiche
- Presenza dei menu File, Modifica, Vista, Impostazioni e Strumenti.
- Persistenza della modalità chiara/scura nelle impostazioni IndexedDB.
- Presenza della vista parole e del comando LIVE per singola slide.
- Persistenza del logo predefinito e suo richiamo tramite comando Logo.

## Limiti della validazione
I test automatici verificano la sintassi e i contratti funzionali statici; non equivalgono a una prova manuale dell'interfaccia Electron su Windows 11. In questa sessione non sono stati eseguiti test con proiettore, doppio monitor, VSD N3 fisico o OBS. La build installabile Windows non è stata generata. Prima dell'uso in diretta, eseguire una prova completa sul computer di regia.
