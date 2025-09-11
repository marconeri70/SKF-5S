/* SKF 5S – v7.2: PUNTI (0/1/3/5) + Linee=L2/L3... + due tasti Settore + voci dal file */
const elAreas = document.getElementById('areas');
const elKpiAreas = document.getElementById('kpiAreas');
const elKpiScore = document.getElementById('kpiScore');
const elKpiLate = document.getElementById('kpiLate');
const elQ = document.getElementById('q');
const elLineFilter = document.getElementById('lineFilter');
const elOnlyLate = document.getElementById('onlyLate');
const elBtnClear = document.getElementById('btnClearFilters');
const btnFgr = document.getElementById('btnFgr');
const btnAsm = document.getElementById('btnAsm');
const btnAll = document.getElementById('btnAll');
const tplArea = document.getElementById('tplArea');
const tplItem = document.getElementById('tplItem');
const storeKey = 'skf.fiveS.v7.2';

const POINTS = [0,1,3,5];

/* ---- Voci dalle tue schede (Excel) ripulite ---- */
const VOC_1S = [
  "Zona pedonale pavimento",
  "Zona di lavoro (pavimento, macchina)",
  "Materiali",
  "Informazioni",
  "Processo di etichettatura"
];
const VOC_2S = [
  "Sicurezza",
  "Qualità",
  "Posizione Pre-Fissate",
  "Documenti",
  "Concetti"
];
const VOC_3S = [
  "Pulizia",
  "Misure preventive",
  "La pulizia è di routine e esiste un piano per un risultato duraturo"
];
const VOC_4S = [
  "Aree di  passaggio",
  "Area di lavoro",
  "Materiali",
  "Informazione",
  "Visual Management"
];
const VOC_5S = [
  "Piano per sostenere il risultato",
  "Piano per risultati duraturi",
  "Coinvolgimento dei membri del team"
];

/* ---- TEMPLATE iniziale: una linea di esempio ---- */
const DEFAULTS = {
  areas: [
    makeArea("L2","Rettifica")
  ]
};
function makeArea(line, sector){
  const map = l => l.map(t=>({t, p:0, note:"", resp:"", due:""}));
  return {
    line,                      // << nome area = codice linea
    sector,                    // "Rettifica" | "Montaggio"
    S: {
      "1S": map(VOC_1S),
      "2S": map(VOC_2S),
      "3S": map(VOC_3S),
      "4S": map(VOC_4S),
      "5S": map(VOC_5S)
    }
  };
}

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

/* ---------- Score ---------- */
function scoreList(list){ if(!list || !list.length) return 0; const sum=list.reduce((a,it)=>a+(+it.p||0),0); return sum/(5*list.length); }
function computeScores(area){
  const byS={}; let sum=0,max=0;
  for(const s of ["1S","2S","3S","4S","5S"]){
    const list=area.S[s]||[]; byS[s]=scoreList(list);
    sum += list.reduce((a,it)=>a+(+it.p||0),0); max += 5*list.length;
  }
  return { areaScore: max? (sum/max):0, byS };
}
function overallStats(areas){
  const arr = areas || state.areas;
  let sum=0,max=0,late=0;
  arr.forEach(a=>{
    for(const s of ["1S","2S","3S","4S","5S"]){
      (a.S[s]||[]).forEach(it=>{ sum+=(+it.p||0); max+=5; if(isOverdue(it.due)) late++; });
    }
  });
  return { score:max?(sum/max):0, late };
}
function fmtPct(x){ return Math.round(x*100) + "%"; }
function isOverdue(iso){ if(!iso) return false; const d=new Date(iso+"T23:59:59"); return d < new Date(); }

/* ---------- Filtri ---------- */
function matchFilters(a){
  if(ui.sector!=="ALL" && a.sector!==ui.sector) return false;
  if(ui.line!=="ALL" && (a.line||"").trim()!==ui.line) return false;
  return true;
}
function filteredAreas(){
  return state.areas.filter(a=>{
    if(!matchFilters(a)) return false;
    if(ui.q.trim()==="" && !ui.onlyLate) return true;
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
}
function refreshLineOptions(){
  const lines = Array.from(new Set(state.areas.map(a=> (a.line||"").trim()).filter(Boolean))).sort();
  const opts = ['<option value="ALL">Linea: Tutte</option>', ...lines.map(l=>`<option value="${l}">${l}</option>`)];
  elLineFilter.innerHTML = opts.join('');
  if(!lines.includes(ui.line)) ui.line='ALL';
  elLineFilter.value = ui.line;
}

/* ---------- Rendering ---------- */
function render(){
  refreshLineOptions();
  const list = filteredAreas();
  elAreas.innerHTML = '';
  list.forEach((area, idx)=> elAreas.appendChild(renderArea(area, state.areas.indexOf(area))));
  updateDashboard(list);
  drawAreasChart();
}

function renderArea(area, idx){
  const node = tplArea.content.firstElementChild.cloneNode(true);
  const lineEl = node.querySelector('.area-line');
  const scoreArea = node.querySelector('.score-val');
  const btnSecRet = node.querySelector('.sec-ret');
  const btnSecMon = node.querySelector('.sec-mont');
  const pills = {
    "1S": node.querySelector('.score-1S'),
    "2S": node.querySelector('.score-2S'),
    "3S": node.querySelector('.score-3S'),
    "4S": node.querySelector('.score-4S'),
    "5S": node.querySelector('.score-5S'),
  };

  lineEl.value = area.line || "";
  btnSecRet.classList.toggle('active', area.sector==="Rettifica");
  btnSecMon.classList.toggle('active', area.sector==="Montaggio");

  lineEl.addEventListener('input', ()=>{ state.areas[idx].line = lineEl.value.trim(); save(); render(); });
  btnSecRet.addEventListener('click', ()=>{ state.areas[idx].sector="Rettifica"; save(); render(); });
  btnSecMon.addEventListener('click', ()=>{ state.areas[idx].sector="Montaggio"; save(); render(); });

  // Tabs
  node.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      node.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      node.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.dataset.s===tab.dataset.s));
    });
  });

  // Panels + items
  node.querySelectorAll('.panel').forEach(panel=>{
    const s = panel.dataset.s; panel.innerHTML='';
    (area.S[s]||[]).forEach((it,i)=> panel.appendChild(renderItem(idx,s,i,it)));
  });

  // Add voce alla S attiva
  node.querySelector('.add-item').addEventListener('click', ()=>{
    const s = node.querySelector('.tab.active').dataset.s;
    state.areas[idx].S[s].push({t:"", p:0, note:"", resp:"", due:""}); save(); render();
  });

  // Collapse / Delete
  node.querySelector('.collapse').addEventListener('click', (e)=>{
    node.classList.toggle('collapsed');
    e.target.textContent = node.classList.contains('collapsed') ? "Espandi" : "Comprimi";
  });
  node.querySelector('.delete-area').addEventListener('click', ()=>{
    if(confirm('Eliminare la linea?')){ state.areas.splice(idx,1); save(); render(); }
  });

  // Score
  const { areaScore, byS } = computeScores(area);
  scoreArea.textContent = fmtPct(areaScore);
  Object.entries(byS).forEach(([k,v])=> pills[k].textContent = fmtPct(v));

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
  points.value = String(POINTS.includes(+item.p)? item.p : 0);
  note.value = item.note || "";
  resp.value = item.resp || "";
  due.value = item.due || "";

  const setLate = ()=> node.classList.toggle('late', isOverdue(due.value));
  setLate();

  txt.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].t = txt.value; save(); });
  points.addEventListener('change', ()=>{ state.areas[aIdx].S[sKey][iIdx].p = +points.value; save(); updateAll(); });
  note.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].note = note.value; save(); });
  resp.addEventListener('input', ()=>{ state.areas[aIdx].S[sKey][iIdx].resp = resp.value; save(); });
  due.addEventListener('change', ()=>{ state.areas[aIdx].S[sKey][iIdx].due = due.value; save(); setLate(); updateDashboard(); });

  node.querySelector('.del').addEventListener('click', ()=>{ state.areas[aIdx].S[sKey].splice(iIdx,1); save(); render(); });

  return node;
}

/* ---------- KPI ---------- */
function updateDashboard(areas){
  const arr = areas || filteredAreas();
  elKpiAreas.textContent = arr.length;
  const { score, late } = overallStats(arr);
  elKpiScore.textContent = fmtPct(score);
  elKpiLate.textContent = late;
}

/* ---------- Grafico per LINEA (TOT + 1S..5S) ---------- */
function drawAreasChart(){
  const c = document.getElementById('chartAreas');
  if(!c) return;
  const ctx = c.getContext('2d');

  const Hpx = 240;
  const W = c.width  = c.clientWidth * devicePixelRatio;
  const H = c.height = Hpx * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0,0,W,H);

  // filtra per settore/linea + testo/ritardi
  const areas = filteredAreas();

  // raggruppa per linea
  const byLine = {};
  areas.forEach(a=>{
    const line = (a.line||'').trim() || '—';
    (byLine[line] ||= []).push(a);
  });

  const groups = Object.entries(byLine).map(([line,list])=>{
    let tot = { "1S":{sum:0,max:0},"2S":{sum:0,max:0},"3S":{sum:0,max:0},"4S":{sum:0,max:0},"5S":{sum:0,max:0} };
    list.forEach(a=>{
      for(const s of ["1S","2S","3S","4S","5S"]){
        (a.S[s]||[]).forEach(it=>{ tot[s].sum+=(+it.p||0); tot[s].max+=5; });
      }
    });
    const byS = {}; for(const s in tot){ byS[s] = tot[s].max ? tot[s].sum/tot[s].max : 0; }
    const sumAll = Object.values(tot).reduce((a,v)=>a+v.sum,0);
    const maxAll = Object.values(tot).reduce((a,v)=>a+v.max,0);
    return { line, vals:{ "TOT":(maxAll?sumAll/maxAll:0), ...byS } };
  }).sort((a,b)=> a.line.localeCompare(b.line));

  const padL=60, padR=16, padT=20, padB=44;
  const plotW = (W/devicePixelRatio) - padL - padR;
  const plotH = (H/devicePixelRatio) - padT - padB;

  // Assi + griglia
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+plotH); ctx.lineTo(padL+plotW,padT+plotH); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.font='12px system-ui, Segoe UI, Roboto';
  for(let i=0;i<=4;i++){ const yv=i*25, y=padT+plotH-(yv/100)*plotH;
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
    ctx.fillText(yv+'%', 8, y+4);
  }
  if(!groups.length) return;

  const gv = n=> getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COLORS={ "TOT":gv('--muted')||'#9bb0d6',"1S":gv('--c1')||'#7a56c6',"2S":gv('--c2')||'#e44f37',"3S":gv('--c3')||'#f3a11a',"4S":gv('--c4')||'#35b468',"5S":gv('--c5')||'#4b88ff' };

  const METRICS=["TOT","1S","2S","3S","4S","5S"];
  const innerGap=4, barW=14, groupW=METRICS.length*barW+(METRICS.length-1)*innerGap, groupGap=Math.max(18, groupW*.9);
  const totalW=groups.length*groupW+(groups.length-1)*groupGap;
  const startX=padL+Math.max(8,(plotW-totalW)/2);

  let x=startX;
  groups.forEach(g=>{
    let bx=x;
    METRICS.forEach(m=>{
      const v=g.vals[m]||0, h=v*plotH, y=padT+plotH-h;
      ctx.fillStyle=COLORS[m]; ctx.fillRect(bx,y,barW,h);
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.textAlign='center';
      ctx.fillText(Math.round(v*100)+'%', bx+barW/2, (h>16? y-4 : padT+plotH-2));
      bx+=barW+innerGap;
    });
    // nome Linea
    ctx.save(); ctx.translate(x+groupW/2, padT+plotH+20); ctx.rotate(-Math.PI/12);
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.textAlign='center'; ctx.fillText(g.line,0,0); ctx.restore();
    x+=groupW+groupGap;
  });

  // Legenda
  const legendX = padL + plotW - 220, legendY = padT - 8;
  ctx.save(); ctx.fillStyle='rgba(15,26,54,0.85)'; ctx.fillRect(legendX-8, legendY-12, 228, 24);
  ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='12px system-ui, Segoe UI, Roboto';
  let lx=legendX, ly=legendY+4;
  METRICS.forEach(m=>{ ctx.fillStyle=COLORS[m]; ctx.fillRect(lx,ly,10,10); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillText(m, lx+14, ly+9); lx+=42; });
  ctx.restore();
}

/* ---------- Top controls ---------- */
document.getElementById('btnNewArea').addEventListener('click', ()=>{
  const line = (prompt("Linea nuova? (es. L3)", "L3") || "").trim() || "Lx";
  const sector = (prompt("Settore? (Rettifica/Montaggio)", "Rettifica") || "Rettifica").trim();
  state.areas.push(makeArea(line, (sector==='Montaggio'?'Montaggio':'Rettifica')));
  save(); render();
});
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `SKF_5S_${new Date().toISOString().slice(0,10)}.json` });
  document.body.appendChild(a); a.click(); a.remove();
});
document.getElementById('fileImport').addEventListener('change', async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  try{
    const data = JSON.parse(await file.text());
    if(!Array.isArray(data.areas)) throw new Error('Formato non valido');
    state = data; save(); render();
  }catch(err){ alert('JSON non valido: '+err.message); }
});
document.getElementById('btnPrint').addEventListener('click', ()=>window.print());

/* Filtri */
elQ.addEventListener('input', ()=>{ ui.q = elQ.value; render(); });
elLineFilter.addEventListener('change', ()=>{ ui.line = elLineFilter.value; render(); });
btnFgr.addEventListener('click', ()=>{ ui.sector='Rettifica'; btnFgr.classList.add('active'); btnAsm.classList.remove('active'); btnAll.classList.remove('active'); render(); });
btnAsm.addEventListener('click', ()=>{ ui.sector='Montaggio'; btnAsm.classList.add('active'); btnFgr.classList.remove('active'); btnAll.classList.remove('active'); render(); });
btnAll.addEventListener('click', ()=>{ ui.sector='ALL'; btnAll.classList.add('active'); btnFgr.classList.remove('active'); btnAsm.classList.remove('active'); render(); });
elOnlyLate.addEventListener('change', ()=>{ ui.onlyLate = elOnlyLate.checked; render(); });
elBtnClear.addEventListener('click', ()=>{
  ui = { q:'', line:'ALL', sector:'ALL', onlyLate:false };
  elQ.value=''; refreshLineOptions(); btnAll.click(); elOnlyLate.checked=false; render();
});

/* Re-render globale */
function updateAll(){ render(); }


