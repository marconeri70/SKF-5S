/* SKF 5S – v3: UI + grafico + filtri (vanilla JS) */
const elAreas = document.getElementById('areas');
const elKpiAreas = document.getElementById('kpiAreas');
const elKpiScore = document.getElementById('kpiScore');
const elKpiLate = document.getElementById('kpiLate');
const elQ = document.getElementById('q');
const elSev = document.getElementById('sev');
const elOnlyLate = document.getElementById('onlyLate');
const elBtnClear = document.getElementById('btnClearFilters');
const tplArea = document.getElementById('tplArea');
const tplItem = document.getElementById('tplItem');
const storeKey = 'skf.fiveS.v3';

const WEIGHTS = { OK:1, MIN:1, MAJ:2, CRIT:3 };

const DEFAULTS = {
  areas: [
    {
      name: "Esempio: OP30 Rettifica",
      S: {
        "1S": [
          {t:"Rimuovere utensili non usati negli ultimi 30 gg", sev:"MIN", done:false, note:"", resp:"", due:""},
          {t:"Separare ricambi buoni da scarti", sev:"MAJ", done:false, note:"", resp:"", due:""}
        ],
        "2S": [
          {t:"Ombre a terra/etichette per posizioni attrezzi", sev:"MIN", done:false, note:"", resp:"", due:""},
          {t:"Kanban min/max consumabili", sev:"MAJ", done:false, note:"", resp:"", due:""}
        ],
        "3S": [
          {t:"Ispezione perdite olio/coolant (tubi/valvole)", sev:"CRIT", done:false, note:"", resp:"", due:""},
          {t:"Pulizia area pavimento/macchina", sev:"MIN", done:false, note:"", resp:"", due:""},
          {t:"Azione causa radice perdite ricorrenti", sev:"MAJ", done:false, note:"", resp:"", due:""}
        ],
        "4S": [
          {t:"SPL: cambio mola & check livelli", sev:"MAJ", done:false, note:"", resp:"", due:""},
          {t:"Colori standard tubi/valvole", sev:"MIN", done:false, note:"", resp:"", due:""}
        ],
        "5S": [
          {t:"Audit settimanale con punteggio", sev:"MIN", done:false, note:"", resp:"", due:""},
          {t:"Brief 5’ inizio turno (sicurezza+5S)", sev:"MIN", done:false, note:"", resp:"", due:""}
        ]
      }
    }
  ]
};

let state = load();
let ui = { q:"", sev:"ALL", onlyLate:false };

render();
updateDashboard();

/* ---- Storage ---- */
function load(){
  try{
    const raw = localStorage.getItem(storeKey);
    return raw ? JSON.parse(raw) : structuredClone(DEFAULTS);
  }catch(e){ console.warn(e); return structuredClone(DEFAULTS); }
}
function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }

/* ---- Filters ---- */
function applyFilters(item){
  const q = ui.q.trim().toLowerCase();
  const sev = ui.sev;
  const ol = ui.onlyLate;
  if (sev !== 'ALL' && item.sev !== sev) return false;
  if (q){
    const bag = `${item.t||''} ${item.note||''} ${item.resp||''}`.toLowerCase();
    if (!bag.includes(q)) return false;
  }
  if (ol){
    if (!isOverdue(item.due) || item.done) return false;
  }
  return true;
}

/* ---- Rendering ---- */
function render(){
  elAreas.innerHTML = '';
  state.areas.forEach((area, idx) => elAreas.appendChild(renderArea(area, idx)));
  updateDashboard();
  drawAreasChart();
}
function renderArea(area, idx){
  const node = tplArea.content.firstElementChild.cloneNode(true);
  const name = node.querySelector('.area-name');
  const scoreArea = node.querySelector('.score-val');
  const pills = {
    "1S": node.querySelector('.score-1S'),
    "2S": node.querySelector('.score-2S'),
    "3S": node.querySelector('.score-3S'),
    "4S": node.querySelector('.score-4S'),
    "5S": node.querySelector('.score-5S'),
  };

  name.value = area.name;
  name.addEventListener('input', () => { state.areas[idx].name = name.value; save(); drawAreasChart(); });

  // tabs
  node.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      node.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      node.querySelectorAll('.panel').forEach(p=>{
        p.classList.toggle('active', p.dataset.s===tab.dataset.s);
      });
    });
  });

  // panels + items (respect filters)
  node.querySelectorAll('.panel').forEach(panel=>{
    const s = panel.dataset.s;
    panel.innerHTML = '';
    (area.S[s] ||= []).forEach((item, iIdx) => {
      if (applyFilters(item)) panel.appendChild(renderItem(idx, s, iIdx, item));
    });
  });

  // add item
  node.querySelector('.add-item').addEventListener('click', ()=>{
    const activeS = node.querySelector('.tab.active').dataset.s;
    const list = state.areas[idx].S[activeS];
    list.push({t:"", sev:"OK", done:false, note:"", resp:"", due:""});
    save(); render();
  });

  // collapse / delete
  node.querySelector('.collapse').addEventListener('click', (e)=>{
    node.classList.toggle('collapsed');
    e.target.textContent = node.classList.contains('collapsed') ? "Espandi" : "Comprimi";
  });
  node.querySelector('.delete-area').addEventListener('click', ()=>{
    if(confirm('Eliminare area?')){ state.areas.splice(idx,1); save(); render(); }
  });

  // scoring
  const { areaScore, byS } = computeScores(area);
  scoreArea.textContent = fmtPct(areaScore);
  Object.entries(byS).forEach(([k,v]) => { if (pills[k]) pills[k].textContent = fmtPct(v); });

  return node;
}

function renderItem(aIdx, sKey, iIdx, item){
  const node = tplItem.content.firstElementChild.cloneNode(true);
  const chk = node.querySelector('.chk');
  const txt = node.querySelector('.txt');
  const sev = node.querySelector('.sev');
  const note = node.querySelector('.note');
  const resp = node.querySelector('.resp');
  const due = node.querySelector('.due');

  txt.value = item.t; sev.value = item.sev; chk.checked = item.done;
  note.value = item.note; resp.value = item.resp || ""; due.value = item.due || "";
  node.dataset.sev = item.sev;
  node.classList.toggle('ok', item.done);

  const setLate = ()=> {
    const isLate = isOverdue(due.value) && !chk.checked;
    node.classList.toggle('late', isLate);
  };
  setLate();

  chk.addEventListener('change', ()=>{
    const it = state.areas[aIdx].S[sKey][iIdx];
    it.done = chk.checked; save(); node.classList.toggle('ok', it.done); updateAll();
  });
  txt.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].t = txt.value; save(); });
  sev.addEventListener('change', ()=>{ 
    state.areas[aIdx].S[sKey][iIdx].sev = sev.value; node.dataset.sev = sev.value; save(); updateAll();
  });
  note.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].note = note.value; save(); });
  resp.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].resp = resp.value; save(); });
  due.addEventListener('change', ()=>{ state.areas[aIdx].S[sKey][iIdx].due = due.value; save(); setLate(); updateDashboard(); });

  node.querySelector('.del').addEventListener('click', ()=>{
    state.areas[aIdx].S[sKey].splice(iIdx,1); save(); render();
  });

  return node;
}

/* ---- Scoring & KPIs ---- */
function computeScores(area){
  const byS = {};
  let sumDone=0, sumTot=0;
  for(const s of ["1S","2S","3S","4S","5S"]) {
    const list = area.S[s] || [];
    let d=0, t=0;
    list.forEach(it => { const w=WEIGHTS[it.sev]||1; t+=w; if(it.done) d+=w; });
    byS[s] = t ? d/t : 0;
    sumDone += d; sumTot += t;
  }
  return { areaScore: sumTot ? sumDone/sumTot : 0, byS };
}
function overallStats(){
  let totD=0, totT=0, late=0;
  state.areas.forEach(a=>{
    for(const s of ["1S","2S","3S","4S","5S"]) {
      (a.S[s]||[]).forEach(it=>{
        const w=WEIGHTS[it.sev]||1; totT+=w; if(it.done) totD+=w;
        if (isOverdue(it.due) && !it.done) late++;
      });
    }
  });
  return { score: (totT? totD/totT : 0), late };
}
function updateDashboard(){
  elKpiAreas.textContent = state.areas.length;
  const { score, late } = overallStats();
  elKpiScore.textContent = fmtPct(score);
  elKpiLate.textContent = late;
}
function fmtPct(x){ return Math.round(x*100) + "%"; }
function isOverdue(iso){ if(!iso) return false; const d=new Date(iso+"T23:59:59"); const now=new Date(); return d<now; }

/* ---- Chart (canvas 2D) ---- */
function drawAreasChart(){
  const c = document.getElementById('chartAreas');
  if(!c) return;
  const ctx = c.getContext('2d');
  const W = c.width = c.clientWidth * devicePixelRatio;
  const H = c.height = 180 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0,0,W,H);

  // data: area names + scores
  const data = state.areas.map(a=>({ name:a.name || 'Area', score: computeScores(a).areaScore }));
  const padL=60, padR=16, padT=20, padB=26;
  const plotW = (W/devicePixelRatio) - padL - padR;
  const plotH = (H/devicePixelRatio) - padT - padB;

  // axes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT+plotH);
  ctx.lineTo(padL+plotW, padT+plotH);
  ctx.stroke();

  // y grid and labels (0,25,50,75,100)
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px system-ui, Segoe UI, Roboto';
  for(let i=0;i<=4;i++){
    const yv = i*25;
    const y = padT + plotH - (yv/100)*plotH;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL+plotW, y); ctx.stroke();
    ctx.fillText(yv+'%', 8, y+4);
  }

  if (data.length === 0) return;

  const bw = Math.max(18, Math.min(60, plotW / (data.length*1.6)));
  const gap = bw*0.6;
  let x = padL + gap;

  data.forEach((d)=>{
    const h = (d.score*plotH);
    const y = padT + plotH - h;
    // bar
    ctx.fillStyle = '#61b0ff';
    ctx.fillRect(x, y, bw, h);
    // label
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const nm = d.name.length>12 ? d.name.slice(0,12)+'…' : d.name;
    ctx.save();
    ctx.translate(x + bw/2, padT + plotH + 14);
    ctx.rotate(-Math.PI/8);
    ctx.textAlign = 'center';
    ctx.fillText(nm, 0, 0);
    ctx.restore();

    // value on top
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(d.score*100)+'%', x + bw/2, y - 4);

    x += bw + gap;
  });
}

/* ---- Top controls ---- */
document.getElementById('btnNewArea').addEventListener('click', ()=>{
  state.areas.push({name:"Nuova area", S:{ "1S":[], "2S":[], "3S":[], "4S":[], "5S":[] }});
  save(); render();
});
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `SKF_5S_${new Date().toISOString().slice(0,10)}.json`
  });
  document.body.appendChild(a); a.click(); a.remove();
});
document.getElementById('fileImport').addEventListener('change', async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const text = await file.text();
  try{
    const data = JSON.parse(text);
    if(!Array.isArray(data.areas)) throw new Error('Formato non valido');
    state = data; save(); render();
  }catch(err){ alert('JSON non valido: ' + err.message); }
});
document.getElementById('btnPrint').addEventListener('click', ()=>window.print());

// filters bindings
elQ.addEventListener('input', ()=>{ ui.q = elQ.value; render(); });
elSev.addEventListener('change', ()=>{ ui.sev = elSev.value; render(); });
elOnlyLate.addEventListener('change', ()=>{ ui.onlyLate = elOnlyLate.checked; render(); });
elBtnClear.addEventListener('click', ()=>{
  ui = { q:'', sev:'ALL', onlyLate:false };
  elQ.value=''; elSev.value='ALL'; elOnlyLate.checked=false; render();
});

function updateAll(){ updateDashboard(); drawAreasChart(); }

