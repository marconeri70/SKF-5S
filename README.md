# SKF 5S – Audit & Checklist (PWA)

Checklist 5S con punteggio, responsabilità e scadenze. Funziona **offline** ed è installabile come app (PWA).

## Come pubblicarla (GitHub Pages)
1. Crea questo repository `skf-5s`.
2. Carica i file di questa cartella e le icone in `assets/`.
3. Imposta **Settings → Pages** → *Deploy from a branch* → Branch `main` (root).
4. Apri l’URL generato. Su smartphone: **Aggiungi alla schermata Home**.

## Uso
- Crea **Aree** (OP10, OP20, Manutenzione).
- Aggiungi voci nelle 5S, assegna **Responsabile** e **Scadenza**.
- Spunta quando completato: il **punteggio** (ponderato per severità) si aggiorna.
- **Esporta/Importa** JSON per condividere i dati. **Stampa/PDF** per il report.

## Note
- I dati sono salvati in `localStorage` del browser.
- Il file `.nojekyll` evita conflitti con GitHub Pages.
