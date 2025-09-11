/* SKF 5S – v7.5: ogni Linea contiene due insiemi (Rettifica + Montaggio) */
const storeKey = 'skf.fiveS.v7.5';
const POINTS=[0,1,3,5];

// --- VOCI UFFICIALI DAL TUO EXCEL ---
const VOC_1S = [
  "Zona pedonale pavimento",
  "Zona di lavoro (pavimento, macchina)",
  "Materiali",
  "Informazioni",
  "Processo di etichettatura",
  "Piano per sostenere il risultato",
  "Coinvolgimento dei membri del team"
];

const VOC_2S = [
  "1-S Stato",
  "Sicurezza",
  "Qualità",
  "Posizione Pre-Fissate",
  "Documenti",
  "Concetti",
  "Piano per risultati duraturi",
  "Coinvolgimento dei membri del team"
];

const VOC_3S = [
  "1-S Stato",
  "2-S Stato",
  "Pulizia",
  "Misure preventive",
  "La pulizia è di routine e esiste un piano per un risultato duraturo",
  "Coinvolgimento dei membri del team"
];

// NB: Il tuo foglio “4-S & 5-S” contiene elementi di entrambe le S.
// Ho assegnato a 4S questi (A–F + N, O):
const VOC_4S = [
  "Aree di passaggio",
  "Area di lavoro",
  "Materiali",
  "Informazione",
  "Visual Management",
  "Posti prefissati",
  "Management Visivo",
  "Standard & Documentazione"
];

// E a 5S questi (P, Q):
const VOC_5S = [
  "Ognuno & Ogni giorno",
  "Miglioramento Continuo"
];

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

function makeSectorSet(){ 
  const map=l=>l.map(t=>({t, p:0, note:"", resp:"", due:""}));
  return { "1S":map(VOC_1S), "2S":map(VOC_2S), "3S":map(VOC_3S), "4S":map(VOC_4S), "5S":map(VOC_5S) };
}
function makeArea(line){ 
  return { line, sectors:{ "Rettifica": makeSectorSet(), "Montaggio": makeSectorSet() } }; 
}

// Load + migrazioni da versioni precedenti
let state = load();
if(!state.areas || !state.areas.length){
  state = { areas:[ makeArea("L2") ] }; save();
} else if (state.areas[0] && state.areas[0].S){ // v7.3/7.4 -> v7.5
  state.areas = state.areas.map(a=>{
    const line = a.line || a.name || "Lx";
    const sectors = { "Rettifica": makeSectorSet(), "Montaggio": makeSectorSet() };
    const srcSect = a.sector || "Rettifica";
    ["1S","2S","3S","4S","5S"].forEach(s=>{
      sectors[srcSect][s] = (a.S?.[s]||[]).map(it=>({ 
        t:it.t||"", p:+it.p||0, note:it.note||"", resp:it.resp||"", due:it.due||"" 
      }));
    });
    return { line, sectors };
  });
  save();
}

let ui = { q:"", line:"ALL", sector:"ALL", onlyLate:false };
render(); updateDashboard();

/* -------- Storage -------- */
function load(){
  try{
    const raw = localStorage.getItem(storeKey) || 
                localStorage.getItem('skf.fiveS.v7.4') || 
                localStorage.getItem('skf.fiveS.v7.3.classic');
    return raw? JSON.parse(raw) : {areas:[]};
  }catch(e){ return {areas:[]}; }
}
function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }

/* -------- Calcoli punteggi -------- */
function scoreList(list){ if(!list||!list.length) return 0; const s=list.reduce((a,it)=>a+(+it.p||0),0); return s/(5*list.length); }
function computeScores(area, sector){
  const getSet = (sec)=> area.sectors[sec];
  const byS = {};
  let sum=0,max=0;
  const secs = sector==="ALL"? ["Rettifica","Montaggio"] : [sector];
  ["1S","2S","3S","4S","5S"].forEach(s=>{
    let arr=[]; secs.forEach(sec=> arr = arr.concat(getSet(sec)[s]||[]));
    byS[s]=scoreList(arr);
    sum += arr.reduce((a,it)=>a+(+it.p||0),0); max += 5*arr.length;
  });
  return { areaScore: max? (sum/max):0, byS };
}
function overallStats(list){
  const arr=list||filteredAreas();
  let sum=0,max=0,late=0;
  arr.forEach(a=>{
    const secs = ui.sector==="ALL"? ["Rettifica","Montaggio"] : [ui.sector];
    secs.forEach(sec=>{
      ["1S","2S","3S","4S","5S"].forEach(s=> 
        (a.sectors[sec][s]||[]).forEach(it=>{
          sum+=(+it.p||0); max+=5; if(isOverdue(it.due)) late++;
        })
      );
    });
  });
  return { score:max? (sum/max):0, late };
}
function fmtPct(x){ return Math.round(x*100)+'%'; }
function isOverdue(iso){ if(!iso) return false; return new Date(iso+'T23:59:59') < new Date(); }

/* -------- Filtri -------- */
function matchFilters(a){
  if(ui.line!=="ALL" && (a.line||"").trim()!==ui.line) return false;
  if(ui.q.trim()==='' && !ui.onlyLate) return true;
  const q=ui.q.trim().toLowerCase();
  const secs = ui.sector==="ALL"? ["Rettifica","Montaggio"] : [ui.sector];
  for(const sec of secs){
    for(const s of ["1S","2S","3S","4S","5S"]){
      for(const it of (a.sectors[sec][s]||[])){
        if(ui.onlyLate && !isOverdue(it.due)) continue;
        const bag = `${it.t||''} ${it.note||''} ${it.resp||''}`.toLowerCase();
        if(bag.includes(q)) return true;
      }
    }
  }
  return false;
}
function filteredAreas(){ return state.areas.filter(matchFilters); }
function refreshLineOptions(){
  const lines = Array.from(new Set(state.areas.map(a=>(a.line||'').trim()).filter(Boolean))).sort();
  const opts = ['<option value="ALL">Linea: Tutte</option>', ...lines.map(l=>`<option value="${l}">${l}</option>`)].join('');
  elLineFilter.innerHTML = opts; if(!lines.includes(ui.line)) ui.line='ALL'; elLineFilter.value=ui.line;
}

/* -------- Rendering -------- */
function render(){
  refreshLineOptions();
  const list = filteredAreas();
  elAreas.innerHTML='';
  list.forEach(area=> elAreas.appendChild(renderArea(area)));
  updateDashboard(list);
  drawAreasChart(); buildLineButtons();
}
function renderArea(area){
  const node = tplArea.content.firstElementChild.cloneNode(true);
  const lineEl = node.querySelector('.area-line');
  const scoreArea = node.querySelector('.score-val');
  const sTabs = node.querySelector('.s-tabs');
  const sectorTabs = node.querySelectorAll('.tab.sec');
  const panels = node.querySelectorAll('.panel');

  let localSector = (ui.sector==="ALL"? "Rettifica" : ui.sector);
  let localS = "1S";

  lineEl.value = area.line || "";
  lineEl.addEventListener('input', ()=>{ area.line = lineEl.value.trim(); save(); render(); });

  sectorTabs.forEach(btn=>btn.addEventListener('click', ()=>{
    sectorTabs.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    localSector = btn.dataset.sector;
    refillPanels();
    updateScores();
  }));
  sectorTabs.forEach(b=> b.classList.toggle('active', b.dataset.sector===localSector));

  sTabs.querySelectorAll('.tab.s').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      sTabs.querySelectorAll('.tab.s').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      localS = tab.dataset.s;
      panels.forEach(p=>p.classList.toggle('active', p.dataset.s===localS));
    });
  });

  node.querySelector('.add-item').addEventListener('click', ()=>{
    const arr = area.sectors[localSector][localS];
    arr.push({t:"", p:0, note:"", resp:"", due:""}); save(); refillPanels(); updateScores();
  });
  node.querySelector('.collapse').addEventListener('click', (e)=>{
    node.classList.toggle('collapsed'); e.target.textContent = node.classList.contains('collapsed') ? "Espandi" : "Comprimi";
  });
  node.querySelector('.delete-area').addEventListener('click', ()=>{
    if(confirm('Eliminare la linea?')){
      const ix = state.areas.indexOf(area); state.areas.splice(ix,1); save(); render();
    }
  });

  function refillPanels(){
    panels.forEach(panel=>{
      const s = panel.dataset.s; panel.innerHTML='';
      (area.sectors[localSector][s]||[]).forEach((it,i)=> panel.appendChild(renderItem(area, localSector, s, i, it)));
      panel.classList.toggle('active', s===localS);
    });
    const pills = {
      "1S": node.querySelector('.score-1S'),
      "2S": node.querySelector('.score-2S'),
      "3S": node.querySelector('.score-3S'),
      "4S": node.querySelector('.score-4S'),
      "5S": node.querySelector('.score-5S'),
    };
    const { byS } = computeScores(area, localSector);
    Object.entries(byS).forEach(([k,v])=> pills[k].textContent = fmtPct(v));
  }
  function updateScores(){
    const { areaScore } = computeScores(area, localSector==="ALL"?"ALL":localSector);
    scoreArea.textContent = fmtPct(areaScore);
  }

  refillPanels(); updateScores();
  return node;
}

function renderItem(area, sector, sKey, iIdx, item){
  const node = tplItem.content.firstElementChild.cloneNode(true);
  const txt=node.querySelector('.txt'), points=node.querySelector('.points'),
        note=node.querySelector('.note'), resp=node.querySelector('.resp'), due=node.querySelector('.due');
  txt.value=item.t||""; points.value=String(POINTS.includes(+item.p)?item.p:0); 
  note.value=item.note||""; resp.value=item.resp||""; due.value=item.due||"";
  const setLate=()=> node.classList.toggle('late', isOverdue(due.value)); setLate();
  txt.addEventListener('input', ()=>{ item.t = txt.value; save(); });
  points.addEventListener('change', ()=>{ item.p = +points.value; save(); updateDashboard(); drawAreasChart(); });
  note.addEventListener('input', ()=>{ item.note = note.value; save(); });
  resp.addEventListener('input', ()=>{ item.resp = resp.value; save(); });
  due.addEventListener('change', ()=>{ item.due = due.value; save(); setLate(); updateDashboard(); });
  node.querySelector('.del').addEventListener('click', ()=>{
    const arr = area.sectors[sector][sKey]; arr.splice(iIdx,1); save(); render();
  });
  return node;
}

/* -------- Dashboard & Grafico -------- */
function updateDashboard(list){
  const arr=list||filteredAreas();
  elKpiAreas.textContent = arr.length;
  const { score, late } = overallStats(arr);
  elKpiScore.textContent = fmtPct(score);
  elKpiLate.textContent = late;
}
function drawAreasChart(){
  const c=document.getElementById('chartAreas'); if(!c) return;
  const ctx=c.getContext('2d');
  const Hpx=240, W=c.width=c.clientWidth*devicePixelRatio, H=c.height=Hpx*devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); ctx.clearRect(0,0,W,H);

  const areas = filteredAreas();
  const groups = areas.map(a=>{
    const secs = ui.sector==="ALL"? ["Rettifica","Montaggio"] : [ui.sector];
    let totals = {"1S":{sum:0,max:0},"2S":{sum:0,max:0},"3S":{sum:0,max:0},"4S":{sum:0,max:0},"5S":{sum:0,max:0}};
    secs.forEach(sec=>{
      ["1S","2S","3S","4S","5S"].forEach(s=> (a.sectors[sec][s]||[]).forEach(it=>{ totals[s].sum+=(+it.p||0); totals[s].max+=5; }));
    });
    const byS={}; for(const s in totals){ byS[s]= totals[s].max? totals[s].sum/totals[s].max : 0; }
    const sumAll=Object.values(totals).reduce((x,v)=>x+v.sum,0), maxAll=Object.values(totals).reduce((x,v)=>x+v.max,0);
    return { line:a.line||'—', vals:{ "TOT":(maxAll?sumAll/maxAll:0), ...byS } };
  }).sort((a,b)=> a.line.localeCompare(b.line));

  const padL=60,padR=16,padT=18,padB=44;
  const plotW=(W/devicePixelRatio)-padL-padR, plotH=(H/devicePixelRatio)-padT-padB;
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+plotH); ctx.lineTo(padL+plotW,padT+plotH); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='12px system-ui';
  for(let i=0;i<=4;i++){ const yv=i*25,y=padT+plotH-(yv/100)*plotH; ctx.fillText(yv+'%',8,y+4); ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke(); }
  if(!groups.length) return;
  const gv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COLORS={ "TOT":'#9bb0d6',"1S":gv('--c1')||'#7a56c6',"2S":gv('--c2')||'#e44f37',"3S":gv('--c3')||'#f3a11a',"4S":gv('--c4')||'#35b468',"5S":gv('--c5')||'#4b88ff' };
  const MET=["TOT","1S","2S","3S","4S","5S"]; const inner=4,bw=14,gw=MET.length*bw+(MET.length-1)*inner,gap=Math.max(18,gw*.9);
  const total=groups.length*gw+(groups.length-1)*gap, start=padL+Math.max(8,(plotW-total)/2);
  let x=start;
  groups.forEach(g=>{
    let bx=x;
    MET.forEach(m=>{ const v=g.vals[m]||0,h=v*plotH,y=padT+plotH-h; ctx.fillStyle=COLORS[m]; ctx.fillRect(bx,y,bw,h); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(Math.round(v*100)+'%', bx+bw/2, (h>16? y-4 : padT+plotH-2)); bx+=bw+inner; });
    ctx.save(); ctx.translate(x+gw/2, padT+plotH+22); ctx.rotate(-Math.PI/12); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(g.line,0,0); ctx.restore();
    x+=gw+gap;
  });
}
function buildLineButtons(){
  const host=document.getElementById('lineBtns'); if(!host) return;
  host.innerHTML='';
  const bAll=document.createElement('button'); bAll.className='btn'+(ui.line==='ALL'?' active':''); bAll.textContent='Tutte';
  bAll.addEventListener('click', ()=>{ ui.line='ALL'; const sel=document.getElementById('lineFilter'); if(sel) sel.value='ALL'; render(); window.scrollTo({top:host.offsetTop,behavior:'smooth'}); });
  host.appendChild(bAll);
  const lines=Array.from(new Set(state.areas.map(a=>(a.line||'').trim()).filter(Boolean))).sort();
  lines.forEach(line=>{
    const b=document.createElement('button'); b.className='btn'+(ui.line===line?' active':''); b.textContent=line;
    b.addEventListener('click', ()=>{ ui.line=line; const sel=document.getElementById('lineFilter'); if(sel) sel.value=line; render(); setTimeout(()=>{ const card=[...document.querySelectorAll('.area .area-line')].find(i=>i.value.trim()===line)?.closest('.area'); card?.scrollIntoView({behavior:'smooth',block:'start'}); },0); });
    host.appendChild(b);
  });
}

/* -------- Controlli top -------- */
document.getElementById('btnNewArea').addEventListener('click', ()=>{
  const line=(prompt("Linea nuova? (es. L3)","L3")||"Lx").trim();
  state.areas.push(makeArea(line)); save(); render();
});
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`SKF_5S_${new Date().toISOString().slice(0,10)}.json`});
  document.body.appendChild(a); a.click(); a.remove();
});
document.getElementById('fileImport').addEventListener('change', async (e)=>{
  const f=e.target.files[0]; if(!f) return;
  try{ state=JSON.parse(await f.text()); save(); render(); }
  catch(err){ alert('JSON non valido'); }
});
document.getElementById('btnPrint').addEventListener('click', ()=>window.print());

elQ.addEventListener('input', ()=>{ ui.q=elQ.value; render(); });
elLineFilter.addEventListener('change', ()=>{ ui.line=elLineFilter.value; render(); });
btnFgr.addEventListener('click', ()=>{ ui.sector='Rettifica'; btnFgr.classList.add('active'); btnAsm.classList.remove('active'); btnAll.classList.remove('active'); render(); });
btnAsm.addEventListener('click', ()=>{ ui.sector='Montaggio'; btnAsm.classList.add('active'); btnFgr.classList.remove('active'); btnAll.classList.remove('active'); render(); });
btnAll.addEventListener('click', ()=>{ ui.sector='ALL'; btnAll.classList.add('active'); btnFgr.classList.remove('active'); btnAsm.classList.remove('active'); render(); });
elOnlyLate.addEventListener('change', ()=>{ ui.onlyLate=elOnlyLate.checked; render(); });
elBtnClear.addEventListener('click', ()=>{ 
  ui={q:'',line:'ALL',sector:'ALL',onlyLate:false}; 
  elQ.value=''; elLineFilter.value='ALL'; btnAll.click(); elOnlyLate.checked=false; 
  render(); 
});

// Ridisegna grafico al resize
window.addEventListener('resize', ()=>{ drawAreasChart(); });


