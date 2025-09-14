/* ====================== SKF 5S – App (v7.10) ====================== */
const VERSION = 'v7.10';

const COLORS = {
  s1:'#8b60d3', s2:'#e25555', s3:'#f0b62b', s4:'#27a55f', s5:'#3c7bd8',
  grid:getCss('--chart-grid'), text:getCss('--text')
};
const S_LABELS = ['1S','2S','3S','4S','5S'];

const els = {
  q: qs('#q'),
  selLine: qs('#selLine'),
  sectorPills: qs('#sectorPills'),
  onlyLate: qs('#onlyLate'),
  btnClear: qs('#btnClear'),
  kpiLines: qs('#kpiLines'), kpiAvg: qs('#kpiAvg'), kpiLate: qs('#kpiLate'),
  zoomIn: qs('#zoomIn'), zoomOut: qs('#zoomOut'), chkStacked: qs('#chkStacked'),
  lineChips: qs('#lineChips'),
  btnCollapseAll: qs('#btnCollapseAll'), btnExpandAll: qs('#btnExpandAll'),
  areas: qs('#areas'),
  btnNew: qs('#btnNew'), btnExport: qs('#btnExport'), btnImport: qs('#btnImport'), btnPrint: qs('#btnPrint'),
  btnTheme: qs('#btnTheme'),
  ver: qs('#appVersion')
};
els.ver.textContent = VERSION;

/* ---------- Stato / Storage ---------- */
const LS_KEY = 'skf5s:data';
let DATA = load() ?? seed();

function seed(){
  // dataset minimo di esempio
  return {
    theme:'light',
    zoom:1,
    stacked:true,
    lines:[
      makeLine('CH 2'),
      makeLine('CH 3'),
    ]
  };
}

function makeLine(name){
  return {
    name,
    sector:'rettifica', // default tab aperta
    // percentuali 1S..5S per ogni settore sono calcolate dalle voci
    rettifica: { items: defaultItems(), collapsed:false },
    montaggio: { items: defaultItems(), collapsed:true }
  };
}
function defaultItems(){
  // ognuna ha: titolo, punti(0/1/3/5), responsabile, scad, note
  return [
    { title:'1-S Stato', points:0, resp:'', due:'', note:'' },
    { title:'Sicurezza', points:0, resp:'', due:'', note:'' },
    { title:'Qualità', points:0, resp:'', due:'', note:'' },
    { title:'Pulizia', points:0, resp:'', due:'', note:'' },
  ];
}
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(DATA)); }
function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||''); }catch{ return null; } }

/* ---------- Tema ---------- */
if (DATA.theme) document.documentElement.setAttribute('data-theme', DATA.theme);
els.btnTheme.addEventListener('click', ()=>{
  const t = document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme', t);
  DATA.theme = t; save();
});

/* ---------- UI Helpers ---------- */
function qs(s,root=document){ return root.querySelector(s); }
function qsa(s,root=document){ return [...root.querySelectorAll(s)]; }
function getCss(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function fmt(n, p=0){ return (n||0).toFixed(p); }

/* ---------- Filtri ---------- */
let currentFilter = { q:'', line:'all', sector:'all', onlyLate:false };
function setupFilters(){
  // options line
  els.selLine.innerHTML = `<option value="all">Tutte</option>` + 
    DATA.lines.map((l,i)=>`<option value="${i}">${l.name}</option>`).join('');

  // chips dinamici
  els.lineChips.innerHTML = `<span class="chip">Tutte</span>` + 
    DATA.lines.map((l,i)=>`<button class="chip" data-i="${i}">${l.name}</button>`).join('');

  // listeners
  els.q.addEventListener('input', e=>{ currentFilter.q = e.target.value.trim().toLowerCase(); render(); });
  els.selLine.addEventListener('change', e=>{ currentFilter.line = e.target.value; render(); });
  els.onlyLate.addEventListener('change', e=>{ currentFilter.onlyLate = e.target.checked; render(); });
  els.sectorPills.addEventListener('click', e=>{
    const b = e.target.closest('.pill'); if(!b) return;
    qsa('.pill', els.sectorPills).forEach(p=>p.classList.remove('active'));
    b.classList.add('active');
    currentFilter.sector = b.dataset.sector;
    render();
  });
  els.btnClear.addEventListener('click', ()=>{
    els.q.value=''; els.selLine.value='all'; currentFilter={q:'', line:'all', sector:getActiveSector(), onlyLate:false};
    els.onlyLate.checked=false; render();
  });
  els.lineChips.addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    els.selLine.value = b.dataset.i;
    currentFilter.line = b.dataset.i;
    render();
  });
}
function getActiveSector(){
  const a = qs('.pill.active', els.sectorPills);
  return a ? a.dataset.sector : 'all';
}

/* ---------- Grafico ---------- */
let chart;
function buildChart(datasets, labels){
  if(chart){ chart.destroy(); }
  const stacked = els.chkStacked.checked;

  chart = new Chart(qs('#chart'), {
    type:'bar',
    data:{ labels, datasets },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        x:{ stacked, ticks:{ color: COLORS.text, font:{weight:800} }, grid:{ color:COLORS.grid }},
        y:{ stacked, min:0, max:100, ticks:{ color:COLORS.text, callback:(v)=>v+'%' }, grid:{ color:COLORS.grid }}
      },
      plugins:{
        legend:{ display:false },
        tooltip:{ mode:'index', intersect:false },
        datalabels:{
          color:'#fff', anchor:'end', align:'start', clamp:true, formatter:(v)=> v?`${fmt(v)}%`:'',
          textStrokeColor:'rgba(0,0,0,.5)', textStrokeWidth:2
        }
      }
    },
    plugins:[ChartDataLabels]
  });
}
function makeDatasetsForChart(lines){
  const labels = lines.map(l=>l.name);
  const sColors = [COLORS.s1, COLORS.s2, COLORS.s3, COLORS.s4, COLORS.s5];

  const arr = [0,1,2,3,4].map(sIndex=>{
    return {
      label:S_LABELS[sIndex],
      backgroundColor:sColors[sIndex],
      borderColor:'#fff',
      borderWidth:1,
      data: lines.map(l => getSPercent(l, sIndex+1, l.sector)),
      datalabels:{ display: (ctx)=> ctx.dataset.data[ctx.dataIndex] > 0 }
    };
  });

  // Totale per colonna in modalità unstacked (mostra barra unica "Tot")
  if(!els.chkStacked.checked){
    const tot = lines.map(l => avgLine(l, l.sector));
    arr.unshift({
      label:'Tot',
      backgroundColor:'#aabbd3',
      data: tot,
      datalabels:{ display:(ctx)=> ctx.dataset.data[ctx.dataIndex]>0 }
    });
  }
  return {labels, datasets:arr};
}

/* ---------- Calcoli ---------- */
function itemsFor(line, sector){
  const sec = sector==='montaggio' ? line.montaggio : line.rettifica;
  return sec.items;
}
function getSPercent(line, sIndex, sector){
  // mappo 1S..5S a voci (qui tutte contribuiscono equamente per semplicità)
  const items = itemsFor(line, sector);
  if(items.length===0) return 0;

  // media dei punti mappati su 0..100 (0,1,3,5 equivalgono a 0%,20%,60%,100%)
  const toPct = (p)=> p===0?0 : p===1?20 : p===3?60 : 100;
  const avg = items.reduce((a,it)=>a+toPct(it.points),0) / items.length;
  // Per dare "colore" ai 5 segmenti, ripartiamo la media su tutti (esempio didattico)
  // Se in futuro vuoi pesi diversi per voce → qui.
  return avg;
}
function avgLine(line, sector){
  const arr = [1,2,3,4,5].map(i=>getSPercent(line,i,sector));
  return arr.reduce((a,b)=>a+b,0) / arr.length;
}
function predominantLabel(line, sector){
  let best = 1, bestVal = -1;
  for(let i=1;i<=5;i++){
    const v = getSPercent(line, i, sector);
    if(v>bestVal){bestVal=v; best=i;}
  }
  return `${best}S ${fmt(bestVal)}%`;
}

/* ---------- Rendering principale ---------- */
function render(){
  // filtro linee
  let lines = [...DATA.lines];
  if(currentFilter.line!=='all') lines = [ DATA.lines[+currentFilter.line] ];
  // filtro ricerca
  if(currentFilter.q){
    const q = currentFilter.q;
    lines = lines.filter(l=>{
      const sec= getSector(l);
      return sec.items.some(it =>
        it.title.toLowerCase().includes(q) ||
        (it.resp||'').toLowerCase().includes(q) ||
        (it.note||'').toLowerCase().includes(q)
      );
    });
  }
  // solo in ritardo
  if(currentFilter.onlyLate){
    const isLate = (it)=> it.due && new Date(it.due) < new Date();
    lines = lines.filter(l=> getSector(l).items.some(isLate));
  }

  // KPI
  els.kpiLines.textContent = lines.length;
  const avg = lines.length ? (lines.map(l=>avgLine(l, l.sector)).reduce((a,b)=>a+b,0) / lines.length) : 0;
  els.kpiAvg.textContent = `${fmt(avg)}%`;
  const late = lines.reduce((n,l)=> n + getSector(l).items.filter(it => it.due && new Date(it.due) < new Date()).length, 0);
  els.kpiLate.textContent = late;

  // Chart
  const {labels, datasets} = makeDatasetsForChart(lines);
  buildChart(datasets, labels);

  // Line chips
  els.lineChips.innerHTML = `<button class="chip main">Tutte</button>` + lines.map(l=>`<span class="chip">${l.name}</span>`).join('');

  // Aree
  renderAreas(lines);

  save();
}

function getSector(line){
  const s = (currentFilter.sector==='all') ? line.sector : currentFilter.sector;
  return s==='montaggio' ? line.montaggio : line.rettifica;
}

function renderAreas(lines){
  els.areas.innerHTML = '';
  lines.forEach((line, idx)=>{
    const sector = (currentFilter.sector==='all') ? line.sector : currentFilter.sector;
    const secObj = sector==='montaggio' ? line.montaggio : line.rettifica;

    const area = document.createElement('div');
    area.className = 'area';
    area.innerHTML = `
      <div class="area-head">
        <span class="name">${line.name}</span>
        <div class="badges">
          ${[1,2,3,4,5].map(i=>`<span class="badge s${i}">${i}S ${fmt(getSPercent(line,i,sector))}%</span>`).join('')}
          <span class="badge main">Punteggio: ${fmt(avgLine(line,sector))}%</span>
          <span class="badge">Predominante: ${predominantLabel(line,sector)}</span>
        </div>
      </div>

      <div class="area-toolbar">
        <div class="sector-tabs" data-idx="${idx}">
          <button class="tab ${sector==='rettifica'?'active':''}" data-s="rettifica">Rettifica</button>
          <button class="tab ${sector==='montaggio'?'active':''}" data-s="montaggio">Montaggio</button>
        </div>
        <div class="row gap">
          <button class="btn" data-cmd="add" data-idx="${idx}">+ Voce</button>
          <button class="btn" data-cmd="toggle" data-idx="${idx}">${secObj.collapsed ? 'Espandi' : 'Comprimi'}</button>
          <button class="btn" data-cmd="remove" data-idx="${idx}">Elimina</button>
        </div>
      </div>

      <div class="voc" data-idx="${idx}" style="${secObj.collapsed?'display:none':''}">
        ${secObj.items.map((it,i)=>renderItem(it, idx, i)).join('')}
      </div>
    `;
    els.areas.appendChild(area);
  });

  // listeners tab settore
  qsa('.sector-tabs').forEach(t=>{
    t.addEventListener('click', e=>{
      const b = e.target.closest('.tab'); if(!b) return;
      const i = +t.dataset.idx;
      DATA.lines[i].sector = b.dataset.s;
      currentFilter.sector = 'all'; // mantieni filtro dashboard ma apri tab corrente
      render();
    });
  });

  // toolbar area
  els.areas.addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    const idx = +b.dataset.idx;
    const line = DATA.lines[idx];
    const sec = getSector(line);
    if(b.dataset.cmd==='add'){
      sec.items.push({ title:'Nuova voce', points:0, resp:'', due:'', note:'' });
      render();
    }
    if(b.dataset.cmd==='toggle'){
      sec.collapsed = !sec.collapsed; render();
    }
    if(b.dataset.cmd==='remove'){
      if(confirm(`Eliminare la linea ${line.name}?`)){
        DATA.lines.splice(idx,1); setupFilters(); render();
      }
    }
  });

  // punti click
  qsa('.points').forEach(pWrap=>{
    pWrap.addEventListener('click', e=>{
      const p = e.target.closest('.p'); if(!p) return;
      const iLine = +pWrap.dataset.line, iItem = +pWrap.dataset.item;
      const which = +p.dataset.pt; // 0/1/3/5
      const line = DATA.lines[iLine];
      const sec = getSector(line);
      sec.items[iItem].points = which;
      render();
    });
  });

  // inputs
  qsa('.item-bar').forEach(bar=>{
    bar.addEventListener('input', e=>{
      const iLine = +bar.dataset.line, iItem = +bar.dataset.item;
      const line = DATA.lines[iLine]; const sec = getSector(line); const it = sec.items[iItem];
      if(e.target.name==='resp') it.resp = e.target.value;
      if(e.target.name==='due') it.due = e.target.value;
      if(e.target.name==='note') it.note = e.target.value;
      render();
    });
  });
}

function renderItem(it, iLine, iItem){
  const p = (v)=>`<div class="p p${v} ${it.points===v?'active':''}" data-pt="${v}">${v}</div>`;
  return `
    <div class="item">
      <div class="item-head">
        <div class="item-title">
          <div class="info">i</div>
          <div class="title">${it.title}</div>
        </div>
        <div class="points" data-line="${iLine}" data-item="${iItem}">
          ${p(0)}${p(1)}${p(3)}${p(5)}
        </div>
      </div>
      <div class="item-bar" data-line="${iLine}" data-item="${iItem}">
        <input name="resp" placeholder="Responsabile" value="${it.resp||''}">
        <input name="due" type="date" value="${it.due||''}">
        <textarea name="note" placeholder="Note...">${it.note||''}</textarea>
      </div>
    </div>
  `;
}

/* ---------- Toolbar top ---------- */
els.btnNew.addEventListener('click', ()=>{
  const n = nextLineNumber();
  DATA.lines.push(makeLine(`CH ${n}`));
  setupFilters(); render();
});
function nextLineNumber(){
  const nums = DATA.lines
    .map(l => +(l.name.replace('CH','').trim()))
    .filter(n => !Number.isNaN(n));
  return (nums.length ? Math.max(...nums) : 1) + 1;
}

els.btnExport.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(DATA,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SKF-5S-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
});

els.btnImport.addEventListener('click', ()=>{
  const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.onchange = async ()=> {
    const txt = await inp.files[0].text();
    try{
      const obj = JSON.parse(txt);
      if(!obj.lines) throw Error('Formato non valido');
      DATA = obj; setupFilters(); render();
    }catch(e){ alert('File non valido'); }
  };
  inp.click();
});

els.btnPrint.addEventListener('click', ()=>window.print());

/* ---------- Zoom + stacked ---------- */
els.zoomIn.addEventListener('click', ()=>{ DATA.zoom=Math.min(2, (DATA.zoom||1)+.1); qs('.chart-wrap').style.scale = DATA.zoom; save(); });
els.zoomOut.addEventListener('click', ()=>{ DATA.zoom=Math.max(.8, (DATA.zoom||1)-.1); qs('.chart-wrap').style.scale = DATA.zoom; save(); });
els.chkStacked.checked = !!DATA.stacked;
els.chkStacked.addEventListener('change', ()=>{ DATA.stacked = els.chkStacked.checked; render(); });

/* ---------- Comprimi / Espandi tutto ---------- */
els.btnCollapseAll.addEventListener('click', ()=>{
  getVisibleLines().forEach(l=>{ getSector(l).collapsed = true; });
  render();
});
els.btnExpandAll.addEventListener('click', ()=>{
  getVisibleLines().forEach(l=>{ getSector(l).collapsed = false; });
  render();
});
function getVisibleLines(){
  let lines = [...DATA.lines];
  if(currentFilter.line!=='all') lines = [ DATA.lines[+currentFilter.line] ];
  return lines;
}

/* ---------- Avvio ---------- */
setupFilters();
els.chkStacked.checked = DATA.stacked ?? true;
qs('.chart-wrap').style.scale = DATA.zoom || 1;
render();
