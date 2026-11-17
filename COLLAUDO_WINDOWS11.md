# Collaudo prima dell'uso dal vivo — Windows 11

Questa checklist è necessaria: i test automatici non possono certificare il funzionamento con uno specifico proiettore, GPU, versione OBS o dispositivo VSD N3.

## 1. Installazione e avvio
- [ ] Installare l'app con il file `.exe` prodotto dalla build.
- [ ] Avviare Worship Studio Pro dal menu Start.
- [ ] Chiudere e riaprire l'app: verificare che canti, impostazioni e media persistano.
- [ ] Verificare che Windows Defender Firewall non blocchi il server locale su `127.0.0.1`.

## 2. Proiettore / secondo monitor
- [ ] Collegare il proiettore prima di avviare l'app (HDMI/DisplayPort).
- [ ] In Windows premere `Win + P` e scegliere **Estendi**.
- [ ] Aprire **Schermi & OBS**, aggiornare l'elenco monitor e selezionare il proiettore.
- [ ] Aprire LIVE e verificare che la finestra sia fullscreen sul proiettore, mentre la regia resta sul monitor principale.
- [ ] Provare LIVE, CLEAR e BLACK; verificare che l'uscita segua ogni comando.
- [ ] Scollegare/ricollegare il proiettore solo dopo aver terminato la prova; verificare il recupero selezionando di nuovo il display.

## 3. OBS Studio
- [ ] Usare OBS Studio 28 o successivo e abilitare il server WebSocket in **Strumenti → Impostazioni server WebSocket**.
- [ ] Impostare una password e usare la porta configurata (normalmente `4455`).
- [ ] In Worship Studio Pro inserire host `127.0.0.1`, porta e password, quindi connettere.
- [ ] Creare/aggiornare la Browser Source nella scena attiva.
- [ ] Verificare che testi, immagini e video si aggiornino dopo LIVE, CLEAR e BLACK.
- [ ] Verificare separatamente l'audio dei media e l'opzione OBS **Control audio via OBS**, se necessaria.

## 4. VSD Craft / VSD N3

Le macro tastiera previste sono:

| Tasto | Combinazione | Azione |
|---|---|---|
| PREV | Ctrl + Alt + Freccia sinistra | Slide precedente |
| NEXT | Ctrl + Alt + Freccia destra | Slide successiva |
| LIVE | Ctrl + Alt + Invio | Invia LIVE |
| CLEAR | Ctrl + Alt + Backspace | Svuota l'uscita |
| BLACK | Ctrl + Alt + B | Schermo nero |
| LOGO | Ctrl + Alt + L | Mostra logo |

- [ ] Collegare il N3 direttamente a una porta USB del PC.
- [ ] In VSD Craft creare i sei tasti come macro tastiera con le combinazioni indicate.
- [ ] Portare Worship Studio Pro in primo piano e provare ogni tasto.
- [ ] Ripetere la prova con OBS e la finestra proiettore aperti.

**Limite importante:** in questa versione le combinazioni sono intercettate dalla finestra di Worship Studio Pro; non sono scorciatoie globali di Windows. Perciò l'app deve essere in primo piano quando si usano le macro VSD N3. Non è un plugin VSD nativo e non è previsto feedback dinamico bidirezionale sul display del controller.

## 5. Prova completa
- [ ] Eseguire una prova di almeno 20–30 minuti con la stessa risoluzione e gli stessi media previsti durante l'evento.
- [ ] Provare video lunghi, cambio slide rapido, blackout, clear e ripristino.
- [ ] Verificare che OBS e proiettore mostrino la stessa uscita prevista.
- [ ] Fare un backup `.wspbackup` prima di usare il sistema in produzione.

Non considerare il sistema pronto per un evento finché tutte le verifiche applicabili non sono state completate sul PC e sull'hardware reali.
