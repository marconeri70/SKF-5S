# SKF 5S – Versione 7

- **+ Nuova area** crea un'area già **popolata** con tutte le voci dal template (`DEFAULTS.areas[0]`).
- Pannelli 1S–5S: **mostra solo** la S attiva.
- Punteggi e pill sempre aggiornati (render completo ad ogni modifica).
- Filtri: ricerca, severità, **solo in ritardo**.
- Cruscotto con **grafico a barre** per area.
- **PWA**: installabile e **offline** (service worker).

## Deploy GitHub Pages
1. Copia i file nella root del repo + cartella `assets/` con `skf-logo.png`, `skf-192.png`, `skf-512.png`.
2. Settings → Pages → Deploy from a branch → `main` / root → Save.
3. Apri l’URL e (Chrome) **Installa app**.

## Note
- Modifica il template iniziale in `DEFAULTS.areas[0]`.
- Cambia pesi severità in `WEIGHTS` dentro `app.js`.
- Forza aggiornamento PWA con **CTRL+F5** se non vedi la v7.

