# SKF 5S — v7.17.2

## Novità
- **Grafico**: etichette 1S–5S su riga dedicata, nome linea CH più in basso; padding aumentato.  
- **Stacked**: sposta le percentuali dei segmenti piccoli a **destra** della barra per essere leggibili.  
- **Popup informativo**: clic sulla **i** apre un dialog con titolo+descrizione (delegation globale).  
- **Schede**: badge colorati 1S–5S, nome linea in stile pill; contrasto migliorato in **tema scuro**.  
- **Pallini 0–5**: stile **3D** con progressione cromatica.  
- **Versione** nel **footer** (non nel titolo).

## Aggiornamento
1. Copia i file in questa cartella (`index.html`, `app.js`, `style.css`, `manifest.json`, `sw.js`).  
2. Hard refresh (**Ctrl+F5**). Per PWA: *Application → Service Workers* → **Unregister** → ricarica.

## Note
- Le linee sono **CH** (CH 1, CH 2, …) e hanno punteggi separati.  
- Per personalizzare il popup, usa attributi `data-title` / `data-desc` sui bottoni `.info` oppure aggiungi il testo nella `.s-desc` della voce.
