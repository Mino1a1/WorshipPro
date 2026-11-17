# Stream Deck / Bitfocus Companion — v0.5.0

Worship Studio Pro espone un'API HTTP locale autenticata. Il server ascolta su `127.0.0.1` (porta predefinita 38471, o la porta locale persistita). Il token viene generato casualmente e salvato nella cartella dati dell'app.

## Configurazione
1. Avvia Worship Studio Pro.
2. Apri la scheda **Stream Deck** e copia il token e l'URL base.
3. In Bitfocus Companion aggiungi il modulo **Generic HTTP Request**.
4. Configura una richiesta GET per ciascun tasto con questi percorsi:

- `/api/streamdeck/previous?token=TOKEN`
- `/api/streamdeck/next?token=TOKEN`
- `/api/streamdeck/live?token=TOKEN`
- `/api/streamdeck/clear?token=TOKEN`
- `/api/streamdeck/black?token=TOKEN`
- `/api/streamdeck/logo?token=TOKEN`
- `/api/streamdeck/open-app?token=TOKEN`

Sostituisci TOKEN con il valore mostrato nella scheda Stream Deck. Host `127.0.0.1`, porta indicata nell'URL base. Assegna le richieste ai tasti del profilo Companion/Stream Deck.

## Azioni
- previous / next: naviga le slide del contenuto selezionato e aggiorna il LIVE se è in onda.
- live: invia il contenuto corrente in diretta.
- clear: output vuoto.
- black: schermo nero.
- logo: mostra l'immagine media il cui nome contiene `logo`, oppure un logo testuale.
- open-app: porta la finestra di Worship Studio Pro in primo piano.

## Sicurezza
Il server è limitato a loopback e ogni richiesta richiede il token. Non inoltrare la porta su Internet o su reti non fidate. Se il token viene compromesso, elimina `streamdeck-token.txt` dalla cartella dati utente dell'app e riavvia per generarne uno nuovo.

## Limiti
Questa integrazione è compatibile con tasti HTTP di Bitfocus Companion/Stream Deck; non è un plugin nativo Elgato con icone dinamiche e feedback bidirezionale. Il polling comandi dell'app avviene ogni 300 ms.
