/* SKF 5S – v7.1: PUNTI (0/1/3/5) + Linee (L2,L3,...) + Settori + Grafico per Linea */
const elAreas = document.getElementById('areas');
const elKpiAreas = document.getElementById('kpiAreas');
const elKpiScore = document.getElementById('kpiScore');
const elKpiLate = document.getElementById('kpiLate');
const elQ = document.getElementById('q');
const elLineFilter = document.getElementById('lineFilter');
const elSectorFilter = document.getElementById('sectorFilter');
const elOnlyLate = document.getElementById('onlyLate');
const elBtnClear = document.getElementById('btnClearFilters');
const tplArea = document.getElementById('tplArea');
const tplItem = document.getElementById('tplItem');
const storeKey = 'skf.fiveS.v7.1';

/* PUNTI permessi */
const POINTS = [0,1,3,5];

/* TEMPLATE iniziale - puoi personalizzare le voci */
const DEFAULTS = {
  areas: [
    {
      name: "Rettifica OP30",
      line: "L2",
      sector: "Rettifica",
      S: {
        "1S": [
          {t:"Zona pedonale pavimento", p:1, note:"", resp:"", due:""},
          {t:"Materiali: separare superfluo", p:3, note:"", resp:"", due:""}
        ],
        "2S": [
          {t:"Posizioni predefinite attrezzi", p:1, note:"", resp:"", due:""},
          {t:"Documenti aggiornati/visibili", p:3, note:"", resp:"", due:""}
        ],
        "3S": [
          {t:"Pulizia area e macchine", p:1, note:"", resp:"", due:""},
          {t:"Misure preventive perdite", p:3, note:"", resp:"", due:""}
        ],
        "4S": [
          {t:"Visual management in reparto", p:1, note:"", resp:"", due:""}
        ],
        "5S": [
          {t:"Audit periodico e mantenimento", p:1, note:"", resp:"", due:""}
        ]
      }
    }
  ]
};

let state = load();

let ui = { q:"", line:"ALL", sector:"ALL", onlyLate:false };

initFiltersFromState();
render();
updateDashboard();

/* ---------- Storage ---------- */
function load(){
  try{
    const raw = localStorage.getItem(storeKey);
    return raw ? JSON.parse(raw) : structuredClone(DEFAULTS);
  }catch(e){ console.warn(e); return structuredClone(DEFAULTS); }
}
function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }

/* ---------- Utility Score PUNTI ---------- */
/* Score S = somma punti / (5 * n.voci) */
function scoreList(list){
  if(!list || list.length===0) return 0;
  const sum = list.reduce((a,it)=> a + (Number(it.p)||0), 0);
  return sum / (5*list.length);
}
function computeScores(area){
  const byS = {};
  let sum = 0, max = 0;
  for(const s of ["1S","2S","3S","4S","5S"]){
    const list = area.S[s] || [];
    const sScore = scoreList(list);
    byS[s] = sScore;
    max += 5 * list.length;
    sum += list.reduce((a,it)=> a + (Number(it.p)||0), 0);
  }
  const areaScore = max>0 ? (sum/max) : 0;
  return { areaScore, byS };
}
function overallStats(filteredAreas){
  const areas = filteredAreas || state.areas;
  let sum=0, max=0, late=0;
  areas.forEach(a=>{
    for(const s of ["1S","2S","3S","4S","5S"]){
      (a.S[s]||[]).forEach(it=>{
        max += 5;
        sum += Number(it.p)||0;
        if (isOverdue(it.due)) late++;
      });
    }
  });
  return { score: max? (sum/max) : 0, late };
}
function fmtPct(x){ return Math.round(x*100) + "%"; }
function isOverdue(iso){ if(!iso) return false; const d=new Date(iso+"T23:59:59"); const now=new Date(); return d<now; }

/* ---------- Filtri ---------- */
function matchFilters(area){
  if(ui.line!=="ALL" && (area.line||"").trim()!==ui.line) return false;
  if(ui.sector!=="ALL" && (area.sector||"").trim()!==ui.sector) return false;
  return true;
}
function filteredAreas(){
  return state.areas.filter(a=> matchFilters(a));
}
function initFiltersFromState(){
  // popola select linea dinamicamente
  const lines = Array.from(new Set(state.areas.map(a=> (a.line||"").trim()).filter(Boolean))).sort();
  elLineFilter.innerHTML = '<option value="ALL">Linea: Tutte</option>' + lines.map(l=>`<option value="${l}">${l}</option>`).join('');
  elLineFilter.value = ui.line;
}

/* ---------- Rendering ---------- */
function render(){
  initFiltersFromState(); // aggiorna elenco linee
  const areasToShow = state.areas.filter(a=>{
    if(!matchFilters(a)) return false;
    // filtro testuale e "solo in ritardo" sugli item
    if(ui.q.trim()==="" && !ui.onlyLate) return true;
    // se filtro attivo, verifica che almeno un item nell'area soddisfi
    const q = ui.q.trim().toLowerCase();
    for(const s of ["1S","2S","3S","4S","5S"]){
      for(const it of (a.S[s]||[])){
        if(ui.onlyLate && !isOverdue(it.due)) continue;
        const bag = `${it.t||''} ${it.note||''} ${it.resp||''}`.toLowerCase();
        if(bag.includes(q)) return true;
      }
    }
    return false;
  });

  elAreas.innerHTML = '';
  areasToShow.forEach((area, idx) => elAreas.appendChild(renderArea(area, state.areas.indexOf(area))));
  updateDashboard(areasToShow);
  drawAreasChart(); // usa filtri correnti
}

function renderArea(area, idx){
  const node = tplArea.content.firstElementChild.cloneNode(true);
  const name = node.querySelector('.area-name');
  const line = node.querySelector('.area-line');
  const sector = node.querySelector('.area-sector');
  const scoreArea = node.querySelector('.score-val');
  const pills = {
    "1S": node.querySelector('.score-1S'),
    "2S": node.querySelector('.score-2S'),
    "3S": node.querySelector('.score-3S'),
    "4S": node.querySelector('.score-4S'),
    "5S": node.querySelector('.score-5S'),
  };

  name.value = area.name || "";
  line.value = area.line || "";
  sector.value = area.sector || "Rettifica";

  name.addEventListener('input', () => { state.areas[idx].name = name.value; save(); drawAreasChart(); });
  line.addEventListener('input', () => { state.areas[idx].line = line.value.trim(); save(); render(); });
  sector.addEventListener('change', () => { state.areas[idx].sector = sector.value; save(); render(); });

  // Tabs
  node.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      node.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      node.querySelectorAll('.panel').forEach(p=>{
        p.classList.toggle('active', p.dataset.s===tab.dataset.s);
      });
    });
  });

  // Panels
  node.querySelectorAll('.panel').forEach(panel=>{
    const s = panel.dataset.s;
    panel.innerHTML = '';
    (area.S[s] ||= []).forEach((item, iIdx) => panel.appendChild(renderItem(idx, s, iIdx, item)));
  });

  // Aggiungi voce alla S attiva
  node.querySelector('.add-item').addEventListener('click', ()=>{
    const activeS = node.querySelector('.tab.active').dataset.s;
    const list = state.areas[idx].S[activeS];
    list.push({t:"", p:0, note:"", resp:"", due:""});
    save(); render();
  });

  // Collapse / Delete
  node.querySelector('.collapse').addEventListener('click', (e)=>{
    node.classList.toggle('collapsed');
    e.target.textContent = node.classList.contains('collapsed') ? "Espandi" : "Comprimi";
  });
  node.querySelector('.delete-area').addEventListener('click', ()=>{
    if(confirm('Eliminare area?')){ state.areas.splice(idx,1); save(); render(); }
  });

  // Punteggi
  const { areaScore, byS } = computeScores(area);
  scoreArea.textContent = fmtPct(areaScore);
  Object.entries(byS).forEach(([k,v]) => { if (pills[k]) pills[k].textContent = fmtPct(v); });

  return node;
}

function renderItem(aIdx, sKey, iIdx, item){
  const node = tplItem.content.firstElementChild.cloneNode(true);
  const txt = node.querySelector('.txt');
  const points = node.querySelector('.points');
  const note = node.querySelector('.note');
  const resp = node.querySelector('.resp');
  const due = node.querySelector('.due');

  txt.value = item.t || "";
  points.value = String(POINTS.includes(Number(item.p)) ? item.p : 0);
  note.value = item.note || "";
  resp.value = item.resp || "";
  due.value = item.due || "";

  const setLate = ()=> node.classList.toggle('late', isOverdue(due.value));
  setLate();

  txt.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].t = txt.value; save(); });
  points.addEventListener('change', ()=>{ state.areas[aIdx].S[sKey][iIdx].p = Number(points.value); save(); updateAll(); });
  note.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].note = note.value; save(); });
  resp.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].resp = resp.value; save(); });
  due.addEventListener('change', ()=>{ state.areas[aIdx].S[sKey][iIdx].due = due.value; save(); setLate(); updateDashboard(); });

  node.querySelector('.del').addEventListener('click', ()=>{
    state.areas[aIdx].S[sKey].splice(iIdx,1); save(); render();
  });

  return node;
}

/* ---------- Dashboard & KPI ---------- */
function updateDashboard(areas){
  const arr = areas || filteredAreas();
  elKpiAreas.textContent = arr.length;
  const { score, late } = overallStats(arr);
  elKpiScore.textContent = fmtPct(score);
  elKpiLate.textContent = late;
}

/* ---------- Grafico per LINEA (TOT + 1S..5S) con filtri Linea/Settore ---------- */
function drawAreasChart(){
  const c = document.getElementById('chartAreas');
  if(!c) return;
  const ctx = c.getContext('2d');

  const Hpx = 240;
  const W = c.width  = c.clientWidth * devicePixelRatio;
  const H = c.height = Hpx * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0,0,W,H);

  // Raggruppa per LINEA, applicando filtri (settore e linea)
  const areas = filteredAreas();
  const byLine = {};
  areas.forEach(a=>{
    const line = (a.line||'').trim() || '—';
    if(!byLine[line]) byLine[line] = [];
    byLine[line].push(a);
  });

  // Calcola score per Linea aggregando le aree della linea
  const groups = Object.entries(byLine).map(([line, list])=>{
    let totals = { "1S":{sum:0,max:0}, "2S":{sum:0,max:0}, "3S":{sum:0,max:0}, "4S":{sum:0,max:0}, "5S":{sum:0,max:0} };
    list.forEach(a=>{
      for(const s of ["1S","2S","3S","4S","5S"]){
        (a.S[s]||[]).forEach(it=>{ totals[s].sum += Number(it.p)||0; totals[s].max += 5; });
      }
    });
    const byS = {};
    for(const s of ["1S","2S","3S","4S","5S"]){
      byS[s] = totals[s].max ? (totals[s].sum / totals[s].max) : 0;
    }
    const totSum = Object.values(totals).reduce((a,v)=>a+v.sum,0);
    const totMax = Object.values(totals).reduce((a,v)=>a+v.max,0);
    const areaScore = totMax? (totSum/totMax) : 0;

    return { line, vals: { "TOT": areaScore, "1S":byS["1S"], "2S":byS["2S"], "3S":byS["3S"], "4S":byS["4S"], "5S":byS["5S"] } };
  }).sort((a,b)=> a.line.localeCompare(b.line));

  const padL=60, padR=16, padT=20, padB=44;
  const plotW = (W/devicePixelRatio) - padL - padR;
  const plotH = (H/devicePixelRatio) - padT - padB;

  // assi + griglia
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT+plotH); ctx.lineTo(padL+plotW, padT+plotH); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px system-ui, Segoe UI, Roboto';
  for(let i=0;i<=4;i++){
    const yv=i*25, y = padT + plotH - (yv/100)*plotH;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL+plotW, y); ctx.stroke();
    ctx.fillText(yv+'%', 8, y+4);
  }

  if (!groups.length) return;

  // palette
  const gv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COLORS = { "TOT": gv('--muted')||'#9bb0d6', "1S":gv('--c1')||'#7a56c6', "2S":gv('--c2')||'#e44f37', "3S":gv('--c3')||'#f3a11a', "4S":gv('--c4')||'#35b468', "5S":gv('--c5')||'#4b88ff' };

  // layout barre: 6 per gruppo
  const METRICS = ["TOT","1S","2S","3S","4S","5S"];
  const innerGap = 4, barW = 14;
  const groupW = METRICS.length*barW + (METRICS.length-1)*innerGap;
  const groupGap = Math.max(18, groupW * 0.9);

  const totalW = groups.length*groupW + (groups.length-1)*groupGap;
  const startX = padL + Math.max(8, (plotW - totalW)/2);

  // disegna gruppi
  let x = startX;
  groups.forEach(g=>{
    let bx = x;
    METRICS.forEach(m=>{
      const val = g.vals[m] ?? 0;
      const h = val * plotH;
      const y = padT + plotH - h;

      ctx.fillStyle = COLORS[m];
      ctx.fillRect(bx, y, barW, h);

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      const topY = h>16 ? y-4 : padT + plotH - 2;
      ctx.fillText(Math.round(val*100)+'%', bx + barW/2, topY);

      bx += barW + innerGap;
    });

    // etichetta LINEA sotto il gruppo
    ctx.save();
    ctx.translate(x + groupW/2, padT + plotH + 20);
    ctx.rotate(-Math.PI/12);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(g.line, 0, 0);
    ctx.restore();

    x += groupW + groupGap;
  });

  // legenda
  const legendX = padL + plotW - 220, legendY = padT - 8;
  ctx.save();
  ctx.fillStyle = 'rgba(15,26,54,0.85)';
  ctx.fillRect(legendX-8, legendY-12, 228, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '12px system-ui, Segoe UI, Roboto';
  let lx = legendX; const ly = legendY+4;
  METRICS.forEach(m=>{
    ctx.fillStyle = COLORS[m];
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(m, lx+14, ly+9);
    lx += 42;
  });
  ctx.restore();
}

/* ---------- Top controls ---------- */
document.getElementById('btnNewArea').addEventListener('click', ()=>{
  const name = (prompt("Nome nuova area?", "Nuova area") || "").trim() || "Nuova area";
  const line = (prompt("Linea (es. L2, L3…)?", "L2") || "").trim();
  const sector = (prompt("Settore? (Rettifica/Montaggio)", "Rettifica") || "Rettifica").trim();
  const tpl = structuredClone(DEFAULTS.areas[0]);
  tpl.name = name; tpl.line = line; tpl.sector = (sector==='Montaggio'?'Montaggio':'Rettifica');
  for(const s of ["1S","2S","3S","4S","5S"]){
    tpl.S[s] = (tpl.S[s]||[]).map(it=>({ t:it.t, p:0, note:"", resp:"", due:"" })); // reset PUNTI e campi
  }
  state.areas.push(tpl);
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

/* Filtri */
elQ.addEventListener('input', ()=>{ ui.q = elQ.value; render(); });
elLineFilter.addEventListener('change', ()=>{ ui.line = elLineFilter.value; render(); });
elSectorFilter.addEventListener('change', ()=>{ ui.sector = elSectorFilter.value; render(); });
elOnlyLate.addEventListener('change', ()=>{ ui.onlyLate = elOnlyLate.checked; render(); });
elBtnClear.addEventListener('click', ()=>{
  ui = { q:'', line:'ALL', sector:'ALL', onlyLate:false };
  elQ.value=''; elLineFilter.value='ALL'; elSectorFilter.value='ALL'; elOnlyLate.checked=false; render();
});

/* Re-render globale su modifiche che impattano i punteggi/grafico */
function updateAll(){ render(); }


