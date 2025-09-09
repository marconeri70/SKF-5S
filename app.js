/* SKF 5S – Audit & Checklist (vanilla JS, localStorage, scoring, due dates) */
const elAreas = document.getElementById('areas');
const elKpiAreas = document.getElementById('kpiAreas');
const elKpiScore = document.getElementById('kpiScore');
const elKpiLate = document.getElementById('kpiLate');
const tplArea = document.getElementById('tplArea');
const tplItem = document.getElementById('tplItem');
const storeKey = 'skf.fiveS.v2';

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

/* ---- Rendering ---- */
function render(){
  elAreas.innerHTML = '';
  state.areas.forEach((area, idx) => elAreas.appendChild(renderArea(area, idx)));
  updateDashboard();
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
  name.addEventListener('input', () => { state.areas[idx].name = name.value; save(); });

  node.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      node.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      node.querySelectorAll('.panel').forEach(p=>{
        p.classList.toggle('active', p.dataset.s===tab.dataset.s);
      });
    });
  });

  node.querySelectorAll('.panel').forEach(panel=>{
    const s = panel.dataset.s;
    (area.S[s] ||= []).forEach((item, iIdx) => panel.appendChild(renderItem(idx, s, iIdx, item)));
  });

  node.querySelector('.add-item').addEventListener('click', ()=>{
    const activeS = node.querySelector('.tab.active').dataset.s;
    const list = state.areas[idx].S[activeS];
    list.push({t:"", sev:"OK", done:false, note:"", resp:"", due:""}); 
    save(); render();
  });

  node.querySelector('.collapse').addEventListener('click', (e)=>{
    node.classList.toggle('collapsed');
    e.target.textContent = node.classList.contains('collapsed') ? "Espandi" : "Comprimi";
  });
  node.querySelector('.delete-area').addEventListener('click', ()=>{
    if(confirm('Eliminare area?')){ state.areas.splice(idx,1); save(); render(); }
  });

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
    it.done = chk.checked; save(); node.classList.toggle('ok', it.done); updateAllScores();
  });
  txt.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].t = txt.value; save(); });
  sev.addEventListener('change', ()=>{ 
    state.areas[aIdx].S[sKey][iIdx].sev = sev.value; node.dataset.sev = sev.value; save(); updateAllScores();
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
  for(const s of ["1S","2S","3S","4S","5S"]){
    const list = area.S[s] || [];
    let d=0, t=0;
    list.forEach(it => { const w=WEIGHTS[it.sev]||1; t+=w; if(it.done) d+=w; });
    byS[s] = t ? d/t : 0;
    sumDone += d; sumTot += t;
  }
  return { areaScore: sumTot ? sumDone/sumTot : 0, byS };
}
function updateAllScores(){ render(); }
function updateDashboard(){
  elKpiAreas.textContent = state.areas.length;
  let totD=0, totT=0, late=0;
  state.areas.forEach(a=>{
    for(const s of ["1S","2S","3S","4S","5S"]){
      (a.S[s]||[]).forEach(it=>{
        const w=WEIGHTS[it.sev]||1; totT+=w; if(it.done) totD+=w;
        if (isOverdue(it.due) && !it.done) late++;
      });
    }
  });
  elKpiScore.textContent = fmtPct(totT ? totD/totT : 0);
  elKpiLate.textContent = late;
}
function fmtPct(x){ return Math.round(x*100) + "%"; }
function isOverdue(iso){ if(!iso) return false; const d=new Date(iso+"T23:59:59"); const now=new Date(); return d<now; }

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
