# Worship Studio Pro — v0.8.0

Applicazione desktop locale per regia worship, testi, media, personalizzazione grafica e uscita multi-destinazione.

## Cosa è implementato in questa milestone

- **Desktop Windows/macOS** tramite Electron.
- **Database locale IndexedDB** con record per canti, scalette, temi, riferimenti ai media, font e versetti importati.
- **Archivio media locale su disco**: immagini, fotografie, video, audio e font vengono copiati in una cartella gestita dall’app e collegati al database; i video non vengono duplicati in memoria IndexedDB nell’app desktop.
- **Bibbia locale**: importazione da PDB convertito/JSON/CSV/TXT, ricerca per testo e riferimento e selezione per libro e capitolo. Il contenuto convertito dal PDB fornito è tenuto separato dal repository, per evitare la pubblicazione involontaria di una traduzione protetta. Lo script di build Windows lo copia nell’app solo per la build locale.
- **Livelli di proiezione indipendenti**: il testo rimane trasparente e senza riquadro; immagini e video sono gestiti sul livello di sfondo e possono essere cambiati senza modificare il testo. Oscuramento e ombra sono regolabili nel tema.
- **Editor canti**: titolo, autore, tonalità, sequenze di slide, modifica del testo, duplicazione, riordino e divisione del testo in slide. Sezioni musicali: Intro strumentale, Strofa, Pre-ritornello, Ritornello/Chorus, Bridge/Ponte, Interludio, Vamp, Tag e Finale.
- **EasyWorship Import PRO (beta)**: lettura diretta in sola lettura delle coppie SQLite `Songs.db` + `SongWords.db` quando presenti nella cartella selezionata, oltre a importazione batch di canti RTF/TXT, temi JSON compatibili, font e media da cartelle profilo/Resources. Mantiene titolo/autore/tonalità quando indicati nel testo, segmenta le sezioni riconosciute e crea un tema locale usando i principali attributi RTF riconoscibili (font, dimensione, colore, grassetto).
- **Scaletta**: aggiunta, rimozione e riordino di canti, testi liberi, versetti e media.
- **Testo libero**: crea un contenuto da zero, scrivilo nel pannello oppure direttamente nell’anteprima e salvalo come elemento della scaletta.
- **Editor temi**: colore e media di sfondo, font, dimensioni, peso, colore testo, allineamento, posizione, oscuramento, ombra, spaziatura e interlinea.
- **Import font personali**: TTF, OTF, WOFF e WOFF2. Sono disponibili anche i font già installati nel sistema.
- **Media manager**: importazione di immagini, video e audio; anteprima del media selezionato, assegnazione alla scaletta e uso come sfondo del tema. Puoi anche trascinare file direttamente sull’anteprima per importarli come sfondo.
- **Output separato**: finestra fullscreen posizionata sul monitor scelto (Electron); riceve lo stesso stato LIVE pubblicato dalla regia. Tasti rapidi in regia: frecce per navigare, Spazio per inviare/terminare il LIVE, Esc per Clear.
- **OBS WebSocket v5**: connessione autenticata, lettura scena corrente e creazione/aggiornamento di una Browser Source locale con la URL di output.
- **Uscita simultanea**: la finestra display e OBS Browser Source usano la stessa pagina output e lo stesso BroadcastChannel.
- **Bibbia**: importatore locale JSON/CSV/TXT e ricerca di versetti importati. Non viene incluso il testo integrale di traduzioni protette.
- **Backup**: esportazione e ripristino di un archivio `.wspbackup` con database e media (file molto grandi generano backup grandi).

## Avvio

Requisiti: Windows 11 e Node.js 24 LTS (o superiore compatibile) con npm per la build Windows. La versione desktop usa Electron 45; la release stabile 45.3.2 è stata pubblicata il 12 novembre 2026 e integra Node.js 24.22.2.

```bash
npm install
npm start
```

### Anteprima nel browser (solo prova UI)

È possibile provare l’interfaccia senza installare Electron:

- Windows: eseguire `preview-browser.bat` (serve Python 3).
- macOS: eseguire `preview-browser.command`.
- In alternativa: `python3 -m http.server 8765 --directory app` e aprire `http://127.0.0.1:8765/`.

La modalità browser permette di provare editor, database locale, temi e import media. La gestione reale dei monitor e la creazione OBS via WebSocket richiedono l’app desktop Electron.


## Creazione installer

Eseguire sul sistema operativo di destinazione:

```bash
npm run package
```

- Su Windows viene generato un installer NSIS.
- Su macOS viene generato un DMG.
- Per distribuire entrambi i sistemi, eseguire la build separatamente su Windows e macOS. Sono disponibili anche `npm run package:win` e `npm run package:mac`.

## Utilizzo dell'uscita video

1. Collega il proiettore/monitor esterno prima di avviare l'app.
2. Apri **Schermi & OBS**.
3. Seleziona il display esterno e premi **Apri LIVE**.
4. In OBS Studio, aggiungi una sorgente Browser usando l'URL mostrato nella stessa schermata; oppure collega OBS WebSocket e usa **Crea / aggiorna Browser Source in OBS**.
5. Premi **Invia in diretta** dalla regia. La finestra esterna e la Browser Source ricevono lo stesso flusso di stato.

L'URL viene servito su `127.0.0.1` e la porta assegnata viene salvata nel profilo dell'app per mantenere stabile l'origine IndexedDB. OBS deve essere sullo stesso computer.

### Configurare OBS WebSocket

OBS Studio 28 e versioni successive includono obs-websocket. In OBS apri **Strumenti → Impostazioni server WebSocket**, abilita il server e usa la porta configurata (normalmente 4455). Proteggi il collegamento con una password; Worship Studio Pro non memorizza la password.

La sorgente Browser generata si chiama `Worship Studio Pro LIVE` e viene aggiunta alla scena attualmente in programma. La sorgente è indipendente dalle transizioni e dai livelli di OBS.

## Importare una Bibbia

Sono supportati tre formati:

### JSON

```json
{
  "verses": [
    {"translation":"Nome traduzione autorizzata","book":"Genesi","chapter":1,"verse":1,"text":"Testo del versetto"}
  ]
}
```

È accettato anche un array diretto di oggetti. Campi italiani equivalenti `libro`, `capitolo`, `versetto`, `testo`, `traduzione` sono riconosciuti.

### CSV

Colonne: `book,chapter,verse,text,translation`.

### TXT

Una riga per versetto: `Genesi 1:1 | Testo del versetto`.

Importare solo file e traduzioni per i quali si possiedono i diritti o l'autorizzazione di utilizzo e proiezione. Per importare la Nuova Riveduta 2006, ottenere un file/permesso idoneo dal titolare dei diritti e importarlo con questa funzione.

## Database e backup

Il database usa IndexedDB sul profilo locale dell'app. L'app richiede, quando supportato, la persistenza dello storage. I video possono occupare diversi GB: eseguire backup regolari e controllare lo spazio disponibile. Il backup include file multimediali e font convertiti in base64 dentro un singolo file JSON con estensione `.wspbackup`.

## Limiti noti di questa versione

- L'output utilizza il motore multimediale Chromium/Electron e il decoder video del sistema; la prestazione effettiva dipende da codec, GPU, driver e risoluzione del media.
- La Browser Source OBS riceve aggiornamenti LIVE dal server locale ogni 250 ms. I media vengono serviti con richieste HTTP Range e streaming da file, evitando di caricare l’intero video in RAM. L’audio dei media può richiedere l’opzione OBS **Control audio via OBS** e la corretta configurazione del mixer.
- NDI, MIDI, DMX, timecode, automazioni avanzate, streaming incorporato e controllo remoto non sono ancora integrati in questa milestone.
- Il modulo Bibbia gestisce testi importati localmente; non scarica né distribuisce traduzioni protette.
- Per una produzione stabile in culto, testare prima l'intero percorso di proiezione e streaming con il proprio hardware.


## Migrazione da EasyWorship

Guida dettagliata: `docs/EASYWORSHIP_MIGRATION.md`.

EasyWorship documenta l'importazione dei canti in RTF/TXT, l'editing delle etichette delle slide (Verse, Chorus, Intro), l'applicazione di temi a canti e presentazioni e l'esportazione/importazione dei temi. Per una migrazione affidabile:

1. In EasyWorship esporta o salva i singoli canti in RTF (preferito) o TXT.
2. Esporta separatamente i temi tramite la libreria Themes, se la versione in uso offre il comando Export Theme File.
3. Copia in una cartella anche i file media e i font personalizzati utilizzati dai temi.
4. In Worship Studio Pro > Canti usa “Importa cartella backup / Resources” e seleziona la cartella radice del profilo (contenente `v6.1` e `Resources`). Il programma cerca `Songs.db` e `SongWords.db` nella stessa sottocartella, li apre in sola lettura e trasferisce i testi; importa inoltre immagini, video, audio e font trovati nella cartella. In alternativa, usa “Importa da EasyWorship” per file RTF/TXT e temi JSON compatibili.
5. Controlla il risultato: l'importatore crea un tema derivato dai metadati RTF leggibili e segmenta le sezioni musicali riconosciute.

**Limite di compatibilità dichiarato:** i database interni di EasyWorship e alcuni file tema esportati sono formati proprietari/non documentati pubblicamente. Questa versione non promette una conversione byte-per-byte o la riproduzione perfettamente identica di ogni elemento proprietario. I file tema `.ewtheme` non JSON non vengono decodificati; per conservare lo stile, importa anche i canti RTF e i font/media originali e verifica le slide dopo la migrazione. Il processo non modifica né cancella la libreria originale.

La Nuova Riveduta 2006 è protetta da copyright. Worship Studio Pro non scarica o redistribuisce il testo integrale; importa un file di traduzione ottenuto dal titolare dei diritti con autorizzazione all'uso locale e alla proiezione.


### Test automatici

```bash
npm test
```

Il test usa database SQLite sintetici per verificare il percorso di lettura in sola lettura. Per validare la compatibilità con la tua installazione serve una copia di backup del profilo EasyWorship reale.


## v0.5.0 — PDF Import + Stream Deck

### Import PDF
La nuova scheda **Importa PDF** usa `pdf-parse` nell'app Electron per estrarre il testo. Il parser ripulisce alcune convenzioni di accordi e metadati, riconosce le sezioni più comuni (INTRO, VERSE, PRE-CHORUS, CHORUS, BRIDGE, INSTRUMENTAL, VAMP, TAG, FINAL, OUTRO) e consente di correggere tutto prima di salvare il canto. I PDF scansionati richiedono OCR e in questa versione vengono segnalati, non interpretati in modo inventato.

### Stream Deck
La scheda **Stream Deck** mostra token e URL per Bitfocus Companion / Generic HTTP Request. Sono disponibili previous, next, live, clear, black, logo e open-app. Il server HTTP resta su 127.0.0.1 e protegge ogni richiesta con token casuale.

Leggi `docs/PDF_IMPORT.md` e `docs/STREAM_DECK.md` per istruzioni e limiti.


## v0.6.0 — OCR e profilo VSD Craft

- OCR locale per PDF scansiti o con testo non estraibile, con lingua italiana e inglese (`tesseract.js` + `pdfjs-dist` + canvas nativo). Al primo uso possono essere scaricati i modelli linguistici; il contenuto PDF non viene caricato su un servizio remoto.
- Supporto macro tastiera dedicato per VSD Craft / VSDinside StreamDock: Ctrl+Alt+Freccia sinistra/destra, Ctrl+Alt+Invio, Ctrl+Alt+Backspace, Ctrl+Alt+B e Ctrl+Alt+L.
- La scheda Stream Deck contiene la mappatura rapida VSD Craft e continua a offrire API HTTP per Bitfocus Companion.
- Non viene dichiarato un plugin VSD Craft nativo né feedback dinamico bidirezionale: non è stato possibile verificare un SDK pubblico che permetta di implementarli.

Vedere `docs/VSD_CRAFT.md` e `docs/PDF_IMPORT.md`.


## v0.6.1 — Profilo specifico VSD N3 / Windows 11

La guida `docs/VSD_CRAFT.md` ora include la disposizione consigliata dei sei tasti LCD del N3, le macro Worship Studio Pro e la scelta prudenziale di lasciare inizialmente libere le tre manopole. Compatibilità software N3/Windows 11 basata sulle specifiche VSD pubblicate; non è un collaudo su hardware fisico.


## Versione 0.7.0 — Bibbia e sfondo indipendente

Consulta `docs/BIBBIA_PDB.md` per la guida alla Bibbia integrata e ai livelli grafici. La build locale può includere il file JSON derivato dal PDB presente nella cartella privata consegnata insieme al progetto. Il file non va caricato su un repository pubblico senza aver verificato i diritti di distribuzione. In assenza del file, usa la funzione di importazione Bibbia dell’app.


## v0.8.0 — Interfaccia professionale

- Barra menu File, Modifica, Vista, Impostazioni e Strumenti con comandi operativi.
- Modalità chiara/scura persistente nel database locale.
- Vista parole per leggere e gestire i testi dei canti in sequenza, oltre alla vista slide.
- Logo predefinito selezionabile dalla libreria immagini e richiamabile dal tasto Logo / VSD N3.
- Le funzioni già presenti (Bibbia locale, importazione PDF/OCR, media e sfondi trasparenti, LIVE/CLEAR/BLACK, VSD N3 e OBS) sono mantenute.

L'interfaccia adotta convenzioni comuni dei software di presentazione; non copia codice, marchi o asset proprietari di EasyWorship o Presenter Pro.


## Pubblicazione GitHub e GitHub Pages

Il progetto è già organizzato alla radice del repository. Carica i contenuti della cartella `1_CARICA_SU_GITHUB` senza mantenere una cartella genitore aggiuntiva. I workflow in `.github/workflows/` si occupano di: (1) pubblicare l’anteprima browser ricavata da `app/` su GitHub Pages, escludendo `nr94.json`; (2) testare e creare l’installer Windows NSIS.

GitHub Pages è solo un’anteprima browser: la gestione reale del secondo monitor, l’API locale per OBS e il controllo desktop richiedono l’app Electron su Windows.

Leggi `UPLOAD_GITHUB.md` per la procedura di caricamento manuale e `DEPLOY_GITHUB.md` per le procedure di build e release.

**Contenuto Bibbia:** il file convertito dal PDB è nella cartella sorella `2_CONTENUTI_LOCALI_PRIVATI_NON_CARICARE_SU_GITHUB`. `build-windows.ps1` lo copia automaticamente in `app/nr94.json` prima della build locale. Il file è escluso dal repository tramite `.gitignore` e dal sito Pages. Non caricarlo su un repository pubblico senza autorizzazione esplicita alla distribuzione.
