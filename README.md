# SKF 5S – v7.6.2

PWA per audit/checklist 5S (Rettifica & Montaggio, Linee multiple).

## Struttura
- `index.html` – UI e template
- `style.css` – tema chiaro/scuro, 5S, chip e pallini 0/1/3/5
- `app.js` – logica (storage localStorage), grafico canvas, filtri, export/import
- `sw.js` – cache offline
- `manifest.json` – PWA icons & colors
- `assets/` – `skf-logo.png`, `skf-192.png`, `skf-512.png`

## Aggiornare
1. Cambia i file.
2. Bump `CACHE_NAME` in `sw.js`.
3. DevTools → Application → **Unregister** + **Clear site data** → ricarica (Ctrl+F5).


