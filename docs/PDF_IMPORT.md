# Importazione brani da PDF — v0.6.0

## Flusso
1. Seleziona un PDF dalla scheda **Importa PDF**.
2. L'app tenta prima l'estrazione del livello testuale.
3. Se il documento è una scansione o non contiene testo leggibile, passa automaticamente all'OCR locale. È disponibile anche il pulsante **Forza OCR** per documenti con testo digitale mal codificato.
4. Il riconoscimento OCR usa italiano e inglese. Al primo utilizzo Tesseract.js può scaricare i modelli linguistici; dopo il download, il riconoscimento del documento avviene sul computer.
5. Premi **Analizza struttura e pulisci**, controlla titolo, autore, sezioni e testo, poi salva il canto.

## Pulizia e riconoscimento
- rimuove accordi tra parentesi quadre/tonde e righe composte esclusivamente da sigle di accordi;
- riconosce INTRO, VERSE/STROFA, PRE-CHORUS, CHORUS/RITORNELLO, BRIDGE/PONTE, INSTRUMENTAL, VAMP, TAG, FINAL e OUTRO;
- filtra alcune righe editoriali, URL, numeri pagina e intestazioni ripetute;
- conserva i blocchi riconosciuti come slide modificabili.

## Limiti
L'OCR può confondere caratteri, apostrofi, punteggiatura e parole con basso contrasto. La segmentazione è euristica e non sempre può distinguere una riga di accordi sovrapposta al testo. Ogni brano deve essere revisionato prima del salvataggio. Limiti: 80 MB per PDF e 60 pagine per OCR in una singola operazione.
