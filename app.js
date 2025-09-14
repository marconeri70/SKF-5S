/* ==========================================================================
   SKF 5S – v7.9.7  — app.js
   (base stabile + filtro 5S funzionante e “toggle” + reset su cambio settore)
   ========================================================================== */

/* -------------------------
   Stato e persistenza
   ------------------------- */
const STORAGE_KEY = 'skf5s_v797';

const AppState = {
  lines: [],              // array di linee { id, name, sector:'rettifica'|'montaggio', items:[{id, s:1..5, title, score:0|1|3|5, ...}] }
  theme: 'light',         // 'light' | 'dark'
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(AppState, JSON.parse(raw));
  } catch(e){ console.warn('loadState', e); }
}

/* -------------------------
   Util
   ------------------------- */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const uid = () => Math.random().toString(36).slice(2,9);

/* Calcolo punteggi (%) per una linea + breakdown per S */
function computeLineStats(line){
  const byS = {1:[],2:[],3:[],4:[],5:[]};
  line.items.forEach(it => { if(byS[it.s]) byS[it.s].push(it.score||0); });

  const percS = {};
  for (const s of [1,2,3,4,5]) {
    const arr = byS[s];
    const sum = arr.reduce((a,b)=>a+b,0);
    const max = arr.length * 5;
    percS[s] = max ? Math.round((sum/max)*100) : 0;
  }
  // totale medio delle 5S
  const tot = Math.round((Object.values(percS).reduce((a,b)=>a+b,0))/5) || 0;

  // predominante
  let predominantS = 1, predominantV = percS[1];
  for(const s of [2,3,4,5]){
    if(percS[s] > predominantV){ predominantS=s; predominantV=percS[s]; }
  }
  return { tot, percS, predominantS, predominantV };
}

/* -------------------------
   Render (semplificato)
   ------------------------- */
function render(){
  const wrap = $('#lines');
  if (!wrap) return;

  wrap.innerHTML = '';
  AppState.lines.forEach(line => {
    const stats = computeLineStats(line);

    const card = document.createElement('section');
    card.className = 'card line-card';
    card.dataset.lineId = line.id;
    card.innerHTML = `
      <div class="card-header">
        <strong>${line.name}</strong>
        <div class="sector-bar" style="margin-left:auto">
          <button class="sector-btn ${line.sector==='rettifica'?'active':''}" data-sector="rettifica">Rettifica</button>
          <button class="sector-btn ${line.sector==='montaggio'?'active':''}" data-sector="montaggio">Montaggio</button>
        </div>
      </div>
      <div class="card-body">
        <div class="s-pills" style="margin-bottom:10px">
          <span class="s-pill" data-s="1">1S <strong>${stats.percS[1]}%</strong></span>
          <span class="s-pill" data-s="2">2S <strong>${stats.percS[2]}%</strong></span>
          <span class="s-pill" data-s="3">3S <strong>${stats.percS[3]}%</strong></span>
          <span class="s-pill" data-s="4">4S <strong>${stats.percS[4]}%</strong></span>
          <span class="s-pill" data-s="5">5S <strong>${stats.percS[5]}%</strong></span>
        </div>

        <div class="kpi-row" style="margin-bottom:12px">
          <div class="kpi"><div class="t">Punteggio</div><div class="v">${stats.tot}%</div></div>
          <div class="kpi"><div class="t">Predominante</div><div class="v">${stats.predominantS}S ${stats.predominantV}%</div></div>
          <div class="kpi"><div class="t">Voci</div><div class="v">${line.items.length}</div></div>
        </div>

        ${line.items.map(it => `
          <div class="item item-row s${it.s}" data-id="${it.id}" data-s="${it.s}">
            <div class="title">${it.title}</div>
            <div class="row">
              <div class="score">
                <span class="score-dot ${it.score===0?'active':''}" data-p="0">0</span>
                <span class="score-dot ${it.score===1?'active':''}" data-p="1" style="color:var(--s1)">1</span>
                <span class="score-dot ${it.score===3?'active':''}" data-p="3" style="color:var(--s3)">3</span>
                <span class="score-dot ${it.score===5?'active':''}" data-p="5" style="color:var(--s4)">5</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    wrap.appendChild(card);
  });
}

/* -------------------------
   Eventi (punteggio + settore)
   ------------------------- */
function bindEvents(){
  const root = document;

  // assegna punteggio 0/1/3/5
  root.addEventListener('click', e=>{
    const dot = e.target.closest('.score-dot');
    if(!dot) return;
    const row = dot.closest('.item');
    const card = dot.closest('.line-card');
    const lineId = card?.dataset.lineId;
    const itemId = row?.dataset.id;
    const p = Number(dot.dataset.p||0);

    const line = AppState.lines.find(l=>l.id===lineId);
    const it = line?.items.find(i=>i.id===itemId);
    if(!it) return;

    it.score = p;
    saveState();
    render(); // ricalcolo percentuali + refresh UI
  });

  // cambia settore
  root.addEventListener('click', e=>{
    const b = e.target.closest('.sector-btn');
    if(!b) return;
    const card = b.closest('.line-card');
    const line = AppState.lines.find(l=>l.id===card.dataset.lineId);
    if(!line) return;

    line.sector = b.dataset.sector;
    saveState();
    // clear filtro 5S (se attivo) nella card
    if (card.dataset.activeS) window.filterSInCard(card, null);
    render();
  });
}

/* -------------------------
   Dati demo se è vuoto
   ------------------------- */
function seedIfEmpty(){
  if (AppState.lines.length) return;
  AppState.lines = [
    {
      id: uid(), name:'CH 2', sector:'rettifica',
      items: [
        {id:uid(), s:1, title:'1-S Stato', score:0},
        {id:uid(), s:2, title:'Sicurezza', score:0},
        {id:uid(), s:3, title:'Qualità',  score:0},
        {id:uid(), s:4, title:'Pulizia',  score:0},
        {id:uid(), s:5, title:'Audit/Standard', score:0},
      ]
    }
  ];
}

/* -------------------------
   Boot
   ------------------------- */
function init(){
  loadState();
  seedIfEmpty();
  render();
  bindEvents();
}
document.addEventListener('DOMContentLoaded', init);

/* =====================================================================
   5S filter — HOTFIX v7.9.7 (badge 1S–5S filtrano/defiltrano le righe)
   ===================================================================== */
(function () {
  const root = document;

  // Estrae il valore S (1..5) da: data-s, classi s1..s5, oppure testo "1S"
  function readS(el) {
    if (!el) return null;
    if (el.dataset && el.dataset.s) return String(el.dataset.s);
    const cls = (el.className || '').match(/\bs([1-5])\b/i);
    if (cls) return cls[1];
    const txt = (el.textContent || '').trim().toUpperCase();
    const m = txt.match(/\b([1-5])S\b/);
    return m ? m[1] : null;
  }

  function lineCardFrom(el) {
    return el.closest('.line-card, .area-card, .card.line, .card-area');
  }
  function findRows(card) {
    return card ? card.querySelectorAll('.item, .item-row, .list-item') : [];
  }
  function rowS(row) {
    if (!row) return null;
    if (row.dataset && row.dataset.s) return String(row.dataset.s);
    const cls = (row.className || '').match(/\bs([1-5])\b/i);
    return cls ? cls[1] : null;
  }

  function applySFilter(card, s) {
    if (!card) return;
    const prev = card.dataset.activeS || '';
    const next = (s && s === prev) ? '' : (s || '');
    card.dataset.activeS = next;

    // evidenzia badge attivo
    card.querySelectorAll('.s-pill, .s-badge, .tab-s').forEach(b => {
      const bs = readS(b);
      b.classList.toggle('active', next && bs === next);
    });

    // mostra/nasconde righe
    findRows(card).forEach(row => {
      const rs = rowS(row);
      const show = !next || (rs === next);
      row.classList.toggle('is-hidden', !show);
    });
  }

  // Click su badge/tabs 5S
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.s-pill, .s-badge, .tab-s');
    if (!btn) return;
    const s = readS(btn);
    if (!s) return;
    const card = lineCardFrom(btn);
    applySFilter(card, s);
  });

  // Cambio settore ⇒ reset filtro 5S nella stessa card
  root.addEventListener('click', (e) => {
    const t = e.target.closest('.sector-btn, .btn-settore, .settore-toggle');
    if (!t) return;
    const card = lineCardFrom(t);
    if (card && card.dataset.activeS) applySFilter(card, null);
  });

  // Esponi l’API (utile se in futuro lo vuoi richiamare altrove)
  window.filterSInCard = applySFilter;
})();
