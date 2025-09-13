/* SKF 5S – v7.6.3 */
const storeKey = 'skf.fiveS.v7.6.3';
const POINTS = [0,1,3,5];

/* Voci 5S (sintesi Excel) */
const VOC_1S = [
  {title:"Zona pedonale pavimento",desc:"L'area pedonale è esente da congestione/ostacoli (area libera) e da pericoli di inciampo"},
  {title:"Zona di lavoro (pavimento, macchina)",desc:"Presenti solo materiali/strumenti necessari al lavoro attuale; il resto rimosso o contrassegnato"},
  {title:"Materiali",desc:"Solo materiale necessario per l’ordine in corso; obsoleti/non necessari rimossi"},
  {title:"Informazioni",desc:"Solo documenti/poster utili in buone condizioni"},
  {title:"Processo di etichettatura",desc:"Definiti area etichetta rossa, processo e team"},
  {title:"Piano per sostenere il risultato",desc:"Lavagna 5S con azioni, foto Prima/Dopo, punteggi, SPL aggiornati"}
];
const VOC_2S = [
  {title:"1-S Stato",desc:"Team e area definiti, 1S compresa e mantenuta"},
  {title:"Sicurezza",desc:"Articoli/attrezzature sicurezza segnati e accessibili"},
  {title:"Qualità",desc:"Postazioni qualità definite e ordinate"},
  {title:"Documenti",desc:"File/documenti identificati e al punto d’uso"},
  {title:"Concetti",desc:"Miglioramenti: punto d’uso, ergonomia, no sprechi/confusione"},
  {title:"Posizioni prefissate",desc:"Posti fissi/sagome per attrezzi/materiali"},
  {title:"Visual Management di base",desc:"Linee, etichette, colori standard attivi"}
];
const VOC_3S = [
  {title:"1-S Stato",desc:"Stato di 1S mantenuto"},
  {title:"2-S Stato",desc:"Stato di 2S mantenuto"},
  {title:"Pulizia",desc:"Aree pulite, anche punti difficili; niente perdite/ruggine/polvere"},
  {title:"Misure preventive",desc:"Rimosse cause di sporco/perdite; prevenute ricadute"},
  {title:"Pulire è routine",desc:"Routine di pulizia con responsabilità e frequenze"},
  {title:"Standard di pulizia",desc:"Standard e checklist visibili e seguiti"}
];
const VOC_4S = [
  {title:"Aree di passaggio",desc:"Nessun deposito o ostacolo; pavimento libero"},
  {title:"Area di lavoro",desc:"Solo il necessario; resto in attesa rimozione"},
  {title:"Materiali",desc:"Solo i materiali per il lavoro attuale"},
  {title:"Informazione",desc:"Solo informazioni necessarie e in buono stato"},
  {title:"Visual Management",desc:"Indicatori visivi efficaci nella routine"},
  {title:"Posizioni prefissate",desc:"Facile capire cosa manca e dove va rimesso"},
  {title:"Standard lavoro & check",desc:"SPL/istruzioni/check-list visibili e usate"},
  {title:"Etichette e colori",desc:"Etichette chiare, codici colore coerenti"},
  {title:"Marcature tubi/valvole",desc:"Tubi/valvole/strumenti marcati con colori standard"},
  {title:"Segnaletica a terra",desc:"Linee/campiture presenti e mantenute"},
  {title:"Punti di ispezione",desc:"Chiari i punti e cosa verificare"},
  {title:"Single Point Lessons",desc:"SPL aggiornate e usate"},
  {title:"Standard & documentazione",desc:"Documentazione aggiornata e disponibile"},
  {title:"Management visivo avanzato",desc:"Kanban, scorte, allarmi visivi attivi"},
  {title:"Misure preventive",desc:"Anomalie registrate/risolte alla radice"}
];
const VOC_5S = [
  {title:"Ognuno & ogni giorno",desc:"Tutti formati sugli standard e coinvolti"},
  {title:"Miglioramento continuo",desc:"Evidenza prima/dopo; miglioramenti mantenuti"}
];

/* DOM */
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

/* Helpers */
function makeSectorSet(){
  const map = l => l.map(o => ({t:o.title, d:o.desc, p:0, note:"", resp:"", due:""}));
  return { "1S":map(VOC_1S), "2S":map(VOC_2S), "3S":map(VOC_3S), "4S":map(VOC_4S), "5S":map(VOC_5S) };
}
function makeArea(line){ return { line, sectors:{ "Rettifica":makeSectorSet(), "Montaggio":makeSectorSet() } }; }
function fmtPct(x){ return Math.round(x*100)+'%'; }
function isOverdue(iso){ if(!iso) return false; return new Date(iso+'T23:59:59') < new Date(); }

/* Storage */
let state = load();
if(!state.areas?.length){ state = { areas:[ makeArea("L2") ] }; save(); }
function load(){ try{ const raw=localStorage.getItem(storeKey) || localStorage.getItem('skf.fiveS.v7.6.2'); return raw? JSON.parse(raw) : {areas:[]}; }catch(e){ return {areas:[]}; } }
function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }

/* Scores */
function scoreList(list){ if(!list?.length) return 0; const s=list.reduce((a,it)=>a+(+it.p||0),0); return s/(5*list.length); }
function computeScores(area, sector){
  const secs = sector==="ALL"? ["Rettifica","Montaggio"] : [sector];
  const byS={}; let sum=0,max=0;
  ["1S","2S","3S","4S","5S"].forEach(s=>{
    let arr=[]; secs.forEach(sec=> arr=arr.concat(area.sectors[sec][s]||[]));
    byS[s]=scoreList(arr);
    sum+=arr.reduce((a,it)=>a+(+it.p||0),0); max+=5*arr.length;
  });
  return { areaScore: max? (sum/max):0, byS };
}
function overallStats(list){
  const arr=list||filteredAreas(); let sum=0,max=0,late=0;
  arr.forEach(a=>{
    (["Rettifica","Montaggio"]).forEach(sec=>{
      ["1S","2S","3S","4S","5S"].forEach(s=>
        (a.sectors[sec][s]||[]).forEach(it=>{ sum+=(+it.p||0); max+=5; if(isOverdue(it.due)) late++; })
      );
    });
  });
  return { score:max?(sum/max):0, late };
}

/* Filtri */
let ui = { q:"", line:"ALL", sector:"ALL", onlyLate:false };
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
  elLineFilter.innerHTML = ['<option value="ALL">Linea: Tutte</option>', ...lines.map(l=>`<option value="${l}">${l}</option>`)].join('');
  if(!lines.includes(ui.line)) ui.line='ALL'; elLineFilter.value=ui.line;
}

/* Render */
function render(){
  refreshLineOptions();
  const list = filteredAreas();
  elAreas.innerHTML='';
  list.forEach(area=> elAreas.appendChild(renderArea(area)));
  updateDashboard(list);
  drawAreasChart();
  buildLineButtons();
}
function renderArea(area){
  const node = tplArea.content.firstElementChild.cloneNode(true);
  const lineEl = node.querySelector('.area-line');
  const scoreEl = node.querySelector('.score-val');
  const sTabs = node.querySelector('.s-tabs');
  const sectorTabs = node.querySelectorAll('.tab.sec');
  const panels = node.querySelectorAll('.panel');

  let localSector = (ui.sector==="ALL"? "Rettifica" : ui.sector);
  let localS = "1S";

  lineEl.value = area.line||"";
  lineEl.addEventListener('input', ()=>{ area.line=lineEl.value.trim(); save(); render(); });

  sectorTabs.forEach(btn=>btn.addEventListener('click', ()=>{
    sectorTabs.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    localSector = btn.dataset.sector; refillPanels(); updateScore();
  }));
  sectorTabs.forEach(b=>b.classList.toggle('active', b.dataset.sector===localSector));

  sTabs.querySelectorAll('.tab.s').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      sTabs.querySelectorAll('.tab.s').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active'); localS = tab.dataset.s;
      panels.forEach(p=>p.classList.toggle('active', p.dataset.s===localS));
    });
  });

  node.querySelector('.add-item').addEventListener('click', ()=>{
    area.sectors[localSector][localS].push({t:"", d:"", p:0, note:"", resp:"", due:""});
    save(); refillPanels(); updateScore();
  });
  node.querySelector('.collapse').addEventListener('click', (e)=>{
    node.classList.toggle('collapsed'); e.target.textContent = node.classList.contains('collapsed') ? "Espandi" : "Comprimi";
  });
  node.querySelector('.delete-area').addEventListener('click', ()=>{
    if(confirm('Eliminare la linea?')){ state.areas.splice(state.areas.indexOf(area),1); save(); render(); }
  });

  function refillPanels(){
    panels.forEach(panel=>{
      const s=panel.dataset.s; panel.innerHTML='';
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
  function updateScore(){
    scoreEl.textContent = fmtPct( computeScores(area, localSector).areaScore );
  }

  refillPanels(); updateScore();
  return node;
}

function renderItem(area, sector, sKey, iIdx, item){
  const frag = document.createDocumentFragment();
  const node = tplItem.content.firstElementChild.cloneNode(true);
  const descHost = tplItem.content.children[1].cloneNode(true);
  const txt=node.querySelector('.txt'), info=node.querySelector('.info');
  const note=node.querySelector('.note'), resp=node.querySelector('.resp'), due=node.querySelector('.due');
  const dots=node.querySelectorAll('.points-dots .dot');

  // init
  txt.value=item.t||""; note.value=item.note||""; resp.value=item.resp||""; due.value=item.due||"";
  descHost.innerHTML = item.d ? `<h4>${item.t}</h4><p>${item.d}</p>` : "";
  const markDots = ()=>{ dots.forEach(d=> d.classList.toggle('active', +d.dataset.val === (+item.p||0))); };
  markDots();

  const setLate=()=> node.classList.toggle('late', isOverdue(due.value)); setLate();

  // bind
  txt.addEventListener('input', ()=>{ item.t=txt.value;
    if(item.d){ const h = descHost.querySelector('h4'); if(h) h.innerHTML = item.t; }  // <-- FIX qui
    save();
  });
  note.addEventListener('input', ()=>{ item.note=note.value; save(); });
  resp.addEventListener('input', ()=>{ item.resp=resp.value; save(); });
  due.addEventListener('change', ()=>{ item.due=due.value; save(); setLate(); updateDashboard(); });

  dots.forEach(d=>{
    d.addEventListener('click', ()=>{
      item.p = +d.dataset.val; markDots(); save(); updateDashboard(); drawAreasChart();
    });
  });

  info.addEventListener('click', ()=> descHost.classList.toggle('show'));
  node.querySelector('.del').addEventListener('click', ()=>{
    const arr = area.sectors[sector][sKey]; arr.splice(iIdx,1); save(); render();
  });

  frag.appendChild(node); frag.appendChild(descHost);
  return frag;
}

/* Dashboard & Chart */
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
  const DPR = devicePixelRatio||1;
  const Hpx=260, W=c.width=c.clientWidth*DPR, H=c.height=Hpx*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,H);

  const style = getComputedStyle(document.documentElement);
  const GRID = style.getPropertyValue('--chart-grid').trim()||'#d0d7e1';
  const TXT  = style.getPropertyValue('--chart-text').trim()||'#003366';
  const COLORS={ "TOT":'#9bb0d6',"1S":style.getPropertyValue('--c1').trim(),"2S":style.getPropertyValue('--c2').trim(),"3S":style.getPropertyValue('--c3').trim(),"4S":style.getPropertyValue('--c4').trim(),"5S":style.getPropertyValue('--c5').trim() };

  const areas = filteredAreas(); if(!areas.length){ return; }

  const groups = areas.map(a=>{
    let totals = {"1S":{sum:0,max:0},"2S":{sum:0,max:0},"3S":{sum:0,max:0},"4S":{sum:0,max:0},"5S":{sum:0,max:0}};
    ["Rettifica","Montaggio"].forEach(sec=>{
      ["1S","2S","3S","4S","5S"].forEach(s=>(a.sectors[sec][s]||[]).forEach(it=>{ totals[s].sum+=(+it.p||0); totals[s].max+=5; }));
    });
    const byS={}; for(const s in totals){ byS[s]= totals[s].max? totals[s].sum/totals[s].max : 0; }
    const sumAll=Object.values(totals).reduce((x,v)=>x+v.sum,0), maxAll=Object.values(totals).reduce((x,v)=>x+v.max,0);
    return { line:a.line||'—', vals:{ "TOT":(maxAll?sumAll/maxAll:0), ...byS } };
  }).sort((a,b)=> a.line.localeCompare(b.line));

  const padL=60,padR=16,padT=12,padB=48;
  const plotW=(W/DPR)-padL-padR, plotH=(H/DPR)-padT-padB;

  ctx.strokeStyle=GRID; ctx.fillStyle=TXT; ctx.font='12px system-ui';
  ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+plotH); ctx.lineTo(padL+plotW,padT+plotH); ctx.stroke();
  for(let i=0;i<=4;i++){
    const yv=i*25, y=padT+plotH-(yv/100)*plotH;
    ctx.fillText(yv+'%',8,y+4);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
  }

  const MET=["TOT","1S","2S","3S","4S","5S"]; const inner=4,bw=14,gw=MET.length*bw+(MET.length-1)*inner,gap=Math.max(18,gw*.9);
  const total=groups.length*gw+(groups.length-1)*gap, start=padL+Math.max(8,(plotW-total)/2);
  let x=start;
  groups.forEach(g=>{
    let bx=x;
    MET.forEach(m=>{
      const v=g.vals[m]||0,h=v*plotH,y=padT+plotH-h;
      ctx.fillStyle=COLORS[m]; ctx.fillRect(bx,y,bw,h);
      ctx.fillStyle=TXT; ctx.textAlign='center';
      ctx.fillText(Math.round(v*100)+'%', bx+bw/2, (h>16? y-4 : padT+plotH-2));
      bx+=bw+inner;
    });
    ctx.save(); ctx.translate(x+gw/2, padT+plotH+22); ctx.rotate(-Math.PI/12); ctx.fillStyle=TXT; ctx.textAlign='center'; ctx.fillText(g.line,0,0); ctx.restore();
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

/* Top controls */
document.getElementById('btnNewArea').addEventListener('click', ()=>{
  const line=(prompt("Linea nuova? (es. L3)","L3")||"Lx").trim(); state.areas.push(makeArea(line)); save(); render();
});
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`SKF_5S_${new Date().toISOString().slice(0,10)}.json`});
  document.body.appendChild(a); a.click(); a.remove();
});
document.getElementById('fileImport').addEventListener('change', async (e)=>{
  const f=e.target.files[0]; if(!f) return;
  try{ state=JSON.parse(await f.text()); save(); render(); } catch{ alert('JSON non valido'); }
});
document.getElementById('btnPrint').addEventListener('click', ()=>window.print());

elQ.addEventListener('input', ()=>{ ui.q=elQ.value; render(); });
elLineFilter.addEventListener('change', ()=>{ ui.line=elLineFilter.value; render(); });
btnFgr.addEventListener('click', ()=>{ ui.sector='Rettifica'; btnFgr.classList.add('active'); btnAsm.classList.remove('active'); btnAll.classList.remove('active'); render(); });
btnAsm.addEventListener('click', ()=>{ ui.sector='Montaggio'; btnAsm.classList.add('active'); btnFgr.classList.remove('active'); btnAll.classList.remove('active'); render(); });
btnAll.addEventListener('click', ()=>{ ui.sector='ALL'; btnAll.classList.add('active'); btnFgr.classList.remove('active'); btnAsm.classList.remove('active'); render(); });
elOnlyLate.addEventListener('change', ()=>{ ui.onlyLate=elOnlyLate.checked; render(); });
elBtnClear.addEventListener('click', ()=>{ ui={q:'',line:'ALL',sector:'ALL',onlyLate:false}; elQ.value=''; elLineFilter.value='ALL'; btnAll.click(); elOnlyLate.checked=false; render(); });

window.addEventListener('resize', drawAreasChart);

/* Toggle Tema */
const themeBtn = document.getElementById("btnTheme");
const root = document.documentElement;
if(localStorage.getItem("theme")==="dark"){ root.classList.add("dark"); themeBtn.textContent="🌙 Tema"; }
themeBtn.addEventListener("click", ()=>{
  root.classList.toggle("dark");
  const isDark = root.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark":"light");
  themeBtn.textContent = isDark ? "🌙 Tema" : "🌞 Tema";
});

/* Init */
render();


