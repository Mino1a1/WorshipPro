# Bibbia da file PDB

## Sorgente

Il file fornito (`nuova_riveduta.pdb`) è un database Palm di circa 2,26 MB. L'intestazione contiene il titolo “Bibbia Nuova Riveduta” e il testo introduttivo “Versione Nuova Riveduta”. Nei metadati ispezionati non compare l'anno 1994 o 2006: l'app lo etichetta quindi **Nuova Riveduta (edizione non indicata nel PDB)**, senza attribuire un'edizione non dimostrata.

## Contenuto convertito

- 66 libri
- 1.189 capitoli
- 31.100 versetti

I dati sono stati convertiti in `app/nr94.json` per l'uso locale. Al primo avvio, Worship Studio Pro li importa nel database IndexedDB. La prima importazione può richiedere qualche secondo; dopo resta memorizzata sul computer. Non è necessario selezionare manualmente il file PDB ogni volta.

## Uso

1. Avvia Worship Studio Pro.
2. Apri la scheda **Bibbia**.
3. Cerca una parola o un riferimento (ad esempio `Giovanni 3:16`), oppure seleziona un libro e un capitolo.
4. Premi **Aggiungi** sul versetto desiderato per inserirlo nella scaletta.
5. Vai in Regia e manda il versetto LIVE.

Puoi ancora importare altre traduzioni nei formati JSON, CSV o TXT già supportati.

## Livelli testo e sfondo

Il testo proiettato è un livello trasparente, senza pannello o colore di sfondo. Per scegliere cosa mostrare dietro:

1. Importa un'immagine o un video in **Media**.
2. Apri **Temi** e scegli il file in **Immagine / video di sfondo**.
3. Regola oscuramento, ombra, font, dimensione, colore, allineamento e posizione.
4. Salva il tema e usalo per i contenuti della scaletta.

Il testo e lo sfondo sono livelli indipendenti: puoi cambiare immagine o video senza riscrivere il testo. I video di sfondo vengono riprodotti in loop nella finestra LIVE.

## Nota sui diritti

Il programma usa il file PDB che hai fornito e conserva la conversione localmente. Verifica che la tua copia e l'uso previsto siano coperti dai relativi diritti/licenze. Il progetto non carica la traduzione su servizi remoti.
