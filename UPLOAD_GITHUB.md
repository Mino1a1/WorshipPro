# Caricamento manuale su GitHub — WorshipPro

Questa cartella è il contenuto da caricare nella radice del repository `Mino1a1/WorshipPro`.

## Prima del caricamento

1. Estrai lo ZIP completo sul PC.
2. Apri `1_CARICA_SU_GITHUB`.
3. Controlla che al suo interno si vedano direttamente `app`, `electron`, `test`, `.github`, `package.json` e `README.md`.
4. In Windows Esplora file abilita **Visualizza → Mostra → Elementi nascosti**: la cartella `.github` è nascosta perché inizia con un punto.
5. Non caricare la cartella `2_CONTENUTI_LOCALI_PRIVATI_NON_CARICARE_SU_GITHUB`.

## Sostituzione della vecchia struttura

Nel repository attuale la versione precedente è contenuta nella cartella `WorshipStudioPro_v0.8.0 3/`. Prima o dopo il nuovo caricamento, elimina quella vecchia cartella e sostituisci il workflow `.github/workflows/static.yml` con quello presente in questo pacchetto. Non lasciare un secondo workflow Pages che pubblichi la radice sbagliata.

## Upload con il sito GitHub

1. Apri `https://github.com/Mino1a1/WorshipPro`.
2. Seleziona **Add file → Upload files**.
3. Trascina nella pagina tutti i file e le cartelle contenuti in `1_CARICA_SU_GITHUB` (non la cartella genitore). Assicurati che venga caricata anche `.github/workflows/`.
4. Nel campo del commit scrivi `Deploy Worship Studio Pro v0.8.0` e scegli **Commit directly to the main branch**.
5. Attendi che terminino i workflow nella scheda **Actions**.

Se il browser non mantiene la cartella nascosta `.github`, crea i due file dei workflow manualmente in GitHub usando i percorsi e i contenuti presenti in `.github/workflows/` del pacchetto.

## Impostazione Pages

Dopo il caricamento vai in **Settings → Pages → Build and deployment → Source** e scegli **GitHub Actions**. Non scegliere Deploy from a branch.

## Risultati attesi

- Sito anteprima: `https://mino1a1.github.io/WorshipPro/`
- Scheda **Actions**: workflow Pages e workflow Windows build.
- In una run Windows riuscita: artefatto scaricabile `Worship-Studio-Pro-Windows-...` con l’installer `.exe`.

Per una Release vera e propria, usa il tag Git descritto in `DEPLOY_GITHUB.md`. Il sito Pages e l’installer sono due prodotti distinti: il sito è una preview browser, l’installer è l’app Electron per Windows.
