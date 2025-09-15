/* SKF 5S – core v7.16.0
 * Correzioni:
 * - Grafico stacked/non-stacked con 5 colonne per linea
 * - Datalabels su ogni barra (sigla S + %)
 * - Toggle “i” per descrizioni; comprimi/espandi singolo & tutti
 * - Bottoni punteggio 0/1/3/5 con stato e ricalcolo live
 * - Datepicker affidabile, “Nuova linea” con prompt
 */

const VERSION = '7.16.0';
document.getElementById('ver').textContent = 'v' + VERSION;

// ---- Dati base (puoi sostituire con import/export) -------------------------
const VOC = {
  'rett': {
    '1S Stato': 'Selezione del necessario. Superfluo rimosso.',
    'Postazioni': 'Tutto al suo posto, segnaletica chiara.',
    'Pulizia': 'Pulizia costante, rimozione cause dello sporco.',
  },
  'mont': {
    'Sicurezza': 'Area pedonale libera / segnalazioni pericoli.',
    'Qualità'  : 'Standard, attrezzi idonei e identificati.',
  }
};

let state = load() || {
  lines: [
    makeLine('CH 2'),
    makeLine('CH 3'),
  ],
  filter: { q:'', line:'Tutte', seg:'all', late:false, stacked:false, zoom:1 }
};

// utili
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ---- UI init ----------------------------------------------------------------
const selLine = $('#selLine');
const q = $('#q');
const stacked = $('#stacked');
const onlyLate = $('#onlyLate');
const chips = $('#chips');
const ctx = $('#chart').getContext('2d');

Chart.register(ChartDataLabels);
let chart;

// popola select linee + chips sotto grafico
function refreshLineSelectors(){
  // select
  selLine.innerHTML = `<option value="Tutte">Linea: Tutte</option>` +
    state.lines.map((l,i)=>`<option value="${l.name}">${l.name}</option>`).join('');
  selLine.value = state.filter.line;

  // chips
  chips.innerHTML = '';
  const all = chip('Tutte', state.filter.line==='Tutte');
  chips.appendChild(all);
  state.lines.forEach(l=>{
    chips.appendChild(chip(l.name, l.name===state.filter.line));
  });
  function chip(name, active){
    const el = document.createElement('button');
    el.className = 'chip' + (active?' active':'');
    el.textContent = name;
    el.onclick = ()=>{ state.filter.line=name; save(); renderAll(); };
    return el;
  }
}

// crea nuova linea
$('#btnNew').onclick = () => {
  const next = 'CH ' + (state.lines.length ? nextNum(state.lines) : 1);
  const name = prompt('Nome nuova linea:', next);
  if(!name) return;
  state.lines.push(makeLine(name));
  state.filter.line = name;
  save(); renderAll();
};
function nextNum(lines){
  const nums = lines.map(l => parseInt((l.name.match(/\d+/)||[0])[0],10)||0);
  return Math.max(...nums)+1;
}

// export/import
$('#btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify(state)], {type:'application/json'});
  const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'SKF-5S.json'});
  a.click(); URL.revokeObjectURL(a.href);
};
$('#btnImport').onclick = async () => {
  const inp = Object.assign(document.createElement('input'),{type:'file',accept:'.json'});
  inp.onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{ state = JSON.parse(r.result); save(); renderAll(); };
    r.readAsText(f);
  };
  inp.click();
};
$('#btnPrint').onclick = ()=>window.print();

// filtri
q.oninput = ()=>{ state.filter.q=q.value; save(); renderAll(); };
selLine.onchange = ()=>{ state.filter.line = selLine.value; save(); renderAll(); };
onlyLate.onchange = ()=>{ state.filter.late = onlyLate.checked; save(); renderAll(); };
stacked.onchange = ()=>{ state.filter.stacked = stacked.checked; save(); drawChart(); };
$('.seg-toggle').addEventListener('click', e=>{
  if(!e.target.classList.contains('seg')) return;
  $$('.seg-toggle .seg').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active');
  state.filter.seg = e.target.dataset.seg;
  save(); renderAll();
});
$('#btnClear').onclick = ()=>{ q.value=''; state.filter={...state.filter,q:'',line:'Tutte',late:false}; save(); renderAll(); };
$('#zoomIn').onclick  = ()=>{ state.filter.zoom=Math.min(2, state.filter.zoom+0.1); drawChart(); };
$('#zoomOut').onclick = ()=>{ state.filter.zoom=Math.max(0.6, state.filter.zoom-0.1); drawChart(); };

// comprimi/espandi tutte
$('#btnCollapseAll').onclick = ()=>{$$('#areas .item .desc').forEach(d=>d.classList.add('hide'));};
$('#btnExpandAll').onclick  = ()=>{$$('#areas .item .desc').forEach(d=>d.classList.remove('hide'));};

// ---- render aree -------------------------------------------------------------
function renderAreas(){
  $('#areas').innerHTML = '';
  const targetLines = filteredLines();
  targetLines.forEach(line => {
    const node = renderArea(line);
    $('#areas').appendChild(node);
  });
}

function renderArea(line){
  const t = $('#tplArea').content.firstElementChild.cloneNode(true);
  t.dataset.line = line.name;
  t.querySelector('.area-name').value = line.name;

  // top badges
  updateBadges(t, line);

  // set settore toggle attivo
  t.querySelectorAll('.seg-toggle .seg').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.seg===line.seg);
  });

  // pulsanti area
  t.querySelector('.add').onclick = ()=>{ addItem(line); renderAll(); };
  t.querySelector('.collapse').onclick = ()=>{
    t.querySelectorAll('.item .desc').forEach(d=>d.classList.toggle('hide'));
  };
  t.querySelector('.del').onclick = ()=>{
    if(confirm('Eliminare la linea?')){ state.lines = state.lines.filter(l=>l!==line); save(); renderAll(); }
  };
  t.querySelector('.area-name').onchange = (e)=>{
    line.name = e.target.value || line.name; save(); refreshLineSelectors(); drawChart();
  };
  t.querySelector('.seg-toggle').addEventListener('click', e=>{
    if(!e.target.classList.contains('seg')) return;
    t.querySelectorAll('.seg').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    line.seg = e.target.dataset.seg;
    save(); renderAll();
  });

  // items
  const wrap = t.querySelector('.items');
  line.items.forEach(it => wrap.appendChild(renderItem(line, it)));

  return t;
}

function renderItem(line, it){
  const t = $('#tplItem').content.firstElementChild.cloneNode(true);
  t.querySelector('.title').textContent = it.title;
  t.querySelector('.desc').textContent  = it.desc;
  t.querySelector('.resp').value        = it.resp || '';
  t.querySelector('.due').value         = it.due  || '';
  t.querySelector('.note').value        = it.note || '';

  // informazioni / descrizione
  t.querySelector('.info').onclick = ()=> t.querySelector('.desc').classList.toggle('hide');

  // calendario
  t.querySelector('.cal').onclick = ()=> t.querySelector('.due').showPicker ? t.querySelector('.due').showPicker() : t.querySelector('.due').focus();

  // punteggi
  t.querySelectorAll('.pt').forEach(b=>{
    const val = +b.dataset.pt;
    if(val===it.pt) b.classList.add('active');
    b.onclick = ()=>{
      t.querySelectorAll('.pt').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      it.pt = val;
      computeLine(line);
      save(); updateBadges(document.querySelector(`.area[data-line="${line.name}"]`), line);
      drawChart();
    };
  });

  // extras
  t.querySelector('.resp').onchange = e => { it.resp = e.target.value; save(); };
  t.querySelector('.due').onchange  = e => { it.due  = e.target.value; save(); drawChart(); };
  t.querySelector('.note').onchange = e => { it.note = e.target.value; save(); };
  t.querySelector('.del-item').onclick = ()=>{
    if(confirm('Eliminare la voce?')){
      line.items = line.items.filter(x=>x!==it);
      computeLine(line); save(); renderAll();
    }
  };

  return t;
}

function updateBadges(areaNode, line){
  const map = line.perc;
  areaNode.querySelector('.badge.s1').textContent = `1S ${map['1S']}%`;
  areaNode.querySelector('.badge.s2').textContent = `2S ${map['2S']}%`;
  areaNode.querySelector('.badge.s3').textContent = `3S ${map['3S']}%`;
  areaNode.querySelector('.badge.s4').textContent = `4S ${map['4S']}%`;
  areaNode.querySelector('.badge.s5').textContent = `5S ${map['5S']}%`;
  areaNode.querySelector('.badge.tot').textContent = `Punteggio: ${line.total}%`;
  areaNode.querySelector('.badge.pred').textContent = `Predominante: ${line.pred.s} ${line.pred.v}%`;
}

// ---- chart -------------------------------------------------------------------
function drawChart(){
  const lines = filteredLines();
  const stackedOn = state.filter.stacked;

  const labels = lines.map(l=>l.name);
  const colors = {'1S':getCSS('--s1'),'2S':getCSS('--s2'),'3S':getCSS('--s3'),'4S':getCSS('--s4'),'5S':getCSS('--s5')};
  const datasets = [];

  if(stackedOn){
    // una colonna per linea, impilata
    ['1S','2S','3S','4S','5S'].forEach(S=>{
      datasets.push({
        type:'bar', label:S, backgroundColor:colors[S],
        data: lines.map(l=>l.perc[S]),
        stack:'s', datalabels:{anchor:'end',align:'end',formatter:v=>v?`${v}%`:''}
      });
    });
  }else{
    // 5 colonne affiancate per ogni linea
    const group = ['1S','2S','3S','4S','5S'];
    group.forEach((S,i)=>{
      datasets.push({
        type:'bar', label:S, backgroundColor:alpha(colors[S], 0.85),
        data: lines.map(l=>l.perc[S]),
        stack: undefined, // affiancate
        datalabels:{
          anchor:'end',align:'end',
          formatter:v=>v?`${S}\n${v}%`:''}
      });
    });
  }

  const opt = {
    responsive:true,
    maintainAspectRatio:false,
    scales:{
      x:{ stacked: stackedOn, ticks:{ autoSkip:false, maxRotation:0, minRotation:0 }},
      y:{ stacked: stackedOn, beginAtZero:true, max:100, ticks:{ stepSize:25 }}
    },
    plugins:{
      legend:{ display:false },
      datalabels:{
        color:'#0b2440', backgroundColor:'#fff', borderRadius:6, padding:4,
        borderWidth:1, borderColor:'#e6eef7', clamp:true, display:(ctx)=>ctx.dataset.data[ctx.dataIndex]>0
      },
      tooltip:{ enabled:true, callbacks:{ label:(ctx)=> `${ctx.dataset.label}: ${ctx.parsed.y}%` }}
    }
  };

  if(chart) chart.destroy();
  chart = new Chart(ctx, {data:{labels, datasets}, options:opt});
  ctx.canvas.style.transform = `scale(${state.filter.zoom})`;
  ctx.canvas.style.transformOrigin = 'left top';

  // KPI
  $('#kLines').textContent = lines.length;
  $('#kAvg').textContent   = avg(lines.map(l=>l.total)) + '%';
  $('#kLate').textContent  = lines.reduce((a,l)=>a+lateCount(l),0);

  stacked.checked = state.filter.stacked;
  onlyLate.checked = state.filter.late;
}

// ---- logica punteggi ---------------------------------------------------------
function computeLine(line){
  const items = filteredItems(line);
  const byS = {'1S':[], '2S':[], '3S':[], '4S':[], '5S':[]};

  items.forEach(it=>{
    const S = detectS(it.title);
    if(!S) return;
    byS[S].push(it.pt||0);
  });

  const perc = {};
  ['1S','2S','3S','4S','5S'].forEach(S=>{
    const a = byS[S]; const max = a.length*5 || 1;
    const sum = a.reduce((x,y)=>x+y,0);
    perc[S] = Math.round((sum/max)*100);
  });

  line.perc  = perc;
  line.total = avg(Object.values(perc));
  const pairs = Object.entries(perc).sort((a,b)=>b[1]-a[1]);
  line.pred  = {s: pairs[0]?.[0] || '1S', v: pairs[0]?.[1] || 0};
}

function filteredLines(){
  const qx = (state.filter.q||'').toLowerCase();
  const one = state.filter.line;
  let list = state.lines;

  if(one !== 'Tutte') list = list.filter(l=>l.name===one);
  if(state.filter.seg!=='all') list = list.filter(l=>l.seg===state.filter.seg);
  if(state.filter.late) list = list.filter(l=>lateCount(l)>0);

  // ricerca testuale su item/resp/note
  if(qx){
    list = list.filter(l=> filteredItems(l).some(it =>
      (it.title||'').toLowerCase().includes(qx) ||
      (it.desc ||'').toLowerCase().includes(qx) ||
      (it.resp ||'').toLowerCase().includes(qx) ||
      (it.note ||'').toLowerCase().includes(qx)
    ));
  }

  // ricalcola sempre prima di mostrare
  list.forEach(computeLine);
  return list;
}

function filteredItems(line){
  return line.items; // (già separiamo per seg a livello linea)
}

function lateCount(line){
  const today = new Date().toISOString().slice(0,10);
  return line.items.filter(it=> it.due && it.due < today && (it.pt||0)<5).length;
}

// ---- helper/factory ----------------------------------------------------------
function makeLine(name){
  // default settore rettifica
  const seg = 'rett';
  const items = [
    ...Object.entries(VOC.rett).map(([t,d])=>({seg:'rett', title:t, desc:d, pt:0})),
    ...Object.entries(VOC.mont).map(([t,d])=>({seg:'mont', title:t, desc:d, pt:0})),
  ];
  const line = {name, seg:'rett', items};
  computeLine(line);
  return line;
}
function detectS(title){
  // mappatura semplice (adatta alla tua nomenclatura)
  title = title.toLowerCase();
  if(title.includes('stato') || title.includes('selezione')) return '1S';
  if(title.includes('posto') || title.includes('postazioni')) return '2S';
  if(title.includes('puliz')) return '3S';
  if(title.includes('standard') || title.includes('segnale')) return '4S';
  if(title.includes('disciplin') || title.includes('abitudin') || title.includes('migliora')) return '5S';
  // fallback per sicurezza: calcola dallo “scope” corrente
  return '1S';
}

function alpha(hex, a){ // #rrggbb → rgba()
  const c = hex.replace('#','');
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function getCSS(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function avg(arr){ return Math.round(arr.reduce((a,b)=>a+b,0)/(arr.length||1)); }

function save(){ localStorage.setItem('skf5s', JSON.stringify(state)); }
function load(){ try{ return JSON.parse(localStorage.getItem('skf5s')); }catch{return null;} }

// ---- bootstrap ---------------------------------------------------------------
function renderAll(){
  // sincronia controlli
  q.value = state.filter.q||'';
  stacked.checked = state.filter.stacked;
  onlyLate.checked = state.filter.late;

  refreshLineSelectors();
  renderAreas();
  drawChart();
}
renderAll();
