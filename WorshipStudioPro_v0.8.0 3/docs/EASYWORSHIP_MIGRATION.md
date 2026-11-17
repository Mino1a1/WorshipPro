# Migrazione da EasyWorship a Worship Studio Pro

## Importazione diretta del database

1. In EasyWorship apri **Profiles > Profiles Manager** e individua la Instance Location del profilo.
2. Chiudi EasyWorship prima di copiare i file del profilo, per evitare copie incoerenti mentre il database è aperto.
3. Fai una copia di sicurezza della cartella profilo. La struttura documentata comprende `v6.1` (dati/database e impostazioni) e `Resources` (presentazioni, audio, video e immagini).
4. Avvia Worship Studio Pro > Canti > **Importa cartella backup / Resources** e seleziona la cartella radice del profilo.
5. L'importatore cerca `Songs.db` e `SongWords.db` nella stessa sottocartella. Li apre in sola lettura, collega le righe di `song` e `word` tramite l'identificativo del record e copia i canti nel database Worship Studio Pro.
6. I file immagine/video/audio/font trovati nella cartella selezionata vengono copiati nell'archivio locale.

## Struttura musicale

Le etichette riconosciute includono Intro/Intro Instrumental, Verse/Strofa, Pre-Chorus/Pre-Ritornello, Chorus/Ritornello, Bridge/Ponte, Interlude/Interludio, Vamp, Tag/Coda, Final/Finale/Outro. Se nel database EasyWorship la struttura non è memorizzata con etichette separate, l'importatore assegna etichette provvisorie `Strofa 1`, `Strofa 2` ecc.; controllare le sequenze dopo l'importazione.

## Formattazione e temi

Il parser conserva il testo RTF originale nel record del canto e ricava una formattazione di base (primo font utilizzato, dimensione, colore, grassetto/corsivo/sottolineato) per creare un tema iniziale. I font originali devono essere disponibili sul computer o importati dalla cartella. I media usati come sfondo vengono copiati nell'archivio ma l'associazione automatica tra ogni tema EasyWorship e il suo background non è garantita in questa versione.

I temi esportati da EasyWorship possono essere in un formato non JSON specifico dell'applicazione; la versione 0.4 importa temi JSON con lo schema Worship Studio Pro e non decodifica tutti i file tema binari nativi. Per mantenere l'aspetto, conserva la copia originale, importa i media/font e controlla ogni tema dopo il trasferimento.

## Compatibilità e sicurezza

- L'importazione non scrive né modifica `Songs.db` o `SongWords.db` originali.
- L'importatore controlla la presenza delle tabelle `song` e `word` e delle colonne attese; se lo schema differisce, interrompe la lettura.
- Fai sempre una copia di sicurezza e importa una copia del profilo, non il database in uso.
- Il formato e lo schema possono variare tra versioni di EasyWorship; prima della migrazione definitiva confronta conteggio, titoli e testi di un campione.
- L'importazione diretta del database è disponibile nell'app desktop Electron; la modalità browser non può leggere percorsi locali SQLite.
