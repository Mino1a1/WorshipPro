# Profilo VSD Craft — VSD N3 + Windows 11 (Worship Studio Pro 0.6.1)

## Compatibilità
Il VSD N3 è elencato tra i dispositivi supportati da VSD Craft; il software è dichiarato compatibile con Windows 10 e versioni successive. Il N3 dispone di 6 tasti LCD e 3 manopole. Worship Studio Pro usa macro tastiera, senza richiedere un plugin VSD dedicato.

## Configurazione consigliata: una scena, una pagina, sei tasti
In VSD Craft collega il N3 direttamente a una porta USB del PC (evita hub/docking station), avvia VSD Craft, seleziona il dispositivo e crea una scena chiamata **Worship Studio Pro**. Crea una pagina chiamata **Regia**. Trascina sei funzioni Macro/Keyboard Shortcut sui sei tasti LCD e assegna queste combinazioni: 

| Tasto da nominare | Macro tastiera | Funzione |
|---|---|---|
| PREV | Ctrl + Alt + Freccia sinistra | Slide precedente |
| NEXT | Ctrl + Alt + Freccia destra | Slide successiva |
| LIVE | Ctrl + Alt + Invio | Manda in onda la slide selezionata |
| CLEAR | Ctrl + Alt + Backspace | Svuota l'uscita |
| BLACK | Ctrl + Alt + B | Schermo nero |
| LOGO | Ctrl + Alt + L | Mostra il logo configurato nell'app |

L'ordine fisico dei sei tasti può dipendere dall'orientamento del dispositivo: assegna le azioni seguendo le etichette qui sopra, non una numerazione presunta. Personalizza ogni tasto con un'icona e un'etichetta leggibile.

## Le tre manopole del N3
Per la prima configurazione lascia le tre manopole **non assegnate**. Worship Studio Pro non espone al momento controlli rotativi per volume, dissolvenza o navigazione; associarvi azioni non pertinenti o ripetute potrebbe causare cambi slide involontari. Potranno essere configurate in una fase successiva se verranno aggiunti controlli dedicati nell'app.

## Avvio dell'applicazione
Aggiungi, se desiderato, un tasto su una seconda pagina oppure una funzione disponibile nella scena VSD Craft di tipo **Open / Application** e seleziona l'eseguibile di Worship Studio Pro. Il percorso dipende dalla cartella scelta durante l'installazione; non usare un percorso inventato.

## Uso durante la celebrazione
1. Avvia Worship Studio Pro e VSD Craft.
2. Apri il canto/servizio e porta Worship Studio Pro in primo piano.
3. Prova NEXT/PREV, quindi LIVE, CLEAR, BLACK e LOGO prima dell'inizio.
4. Tieni Worship Studio Pro in primo piano mentre usi le macro: sono scorciatoie gestite dalla finestra dell'app e non controlli globali di Windows.
5. In VSD Craft esporta la scena/profilo per conservarne una copia.

## Limiti noti
- Non è stato creato un plugin nativo VSD Craft e non è disponibile qui un feedback bidirezionale verificato sullo stato LIVE.
- Le macro funzionano quando Worship Studio Pro è in primo piano; per controlli HTTP da Companion resta disponibile l'API locale descritta in `STREAM_DECK.md`.
- Non è stato possibile provare fisicamente un N3 in questa sessione: la configurazione è basata sulle specifiche e sulle procedure pubblicate dal produttore.

## Fonti
- FAQ ufficiale VSDinside: https://www.vsdinside.com/pages/faqs
- Download/manuale ufficiale: https://www.vsdinside.com/pages/download
- Scheda VSD Craft su Steam (hardware supportato e requisiti): https://store.steampowered.com/app/4269970/VSD_Craft/
