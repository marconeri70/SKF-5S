/* ================== SKF 5S – v7.15.4 ================== */
const VERSION = '7.15.4';
document.getElementById('version').textContent = `v${VERSION}`;

/* ---------- PWA / Tema ---------- */
(() => {
  if ('serviceWorker' in navigator) {
    // aggiorna eventuali SW vecchi
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.update()));
    navigator.serviceWorker.register('sw.js?v='+VERSION).catch(()=>{});
  }
  const tBtn = document.getElementById('btnTheme');
  const t = localStorage.getItem('theme') || 'light';
  document.documentElement.dataset.theme = t;
  tBtn.addEventListener('click', ()=>{
    const nx = document.documentElement.dataset.theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme = nx;
    localStorage.setItem('theme', nx);
  });
})();

/* ---------- Modello dati ---------- */
const DEFAULT_ITEMS = [
  { id:'zp',  title:'Zona pedonale pavimento',          desc:'Area pedonale libera da congestione/ostacoli (area libera) e da pericoli di inciampo', s:1, v:0, sector:'rettifica', owner:'', note:'', due:''},
  { id:'zl',  title:'Zona di lavoro (pavimento, macchine)', desc:'Ordine e pulizia in area di lavoro, macchine e pavimenti', s:1, v:0, sector:'rettifica', owner:'', note:'', due:''},
  { id:'mat', title:'Materiali',                         desc:'Materiali al loro posto, identificati e senza accumuli inutili', s:2, v:0, sector:'rettifica', owner:'', note:'', due:''},
  { id:'proc',title:'Processo di etichettatura',         desc:'Etichette leggibili e standard; identificazione chiara', s:3, v:0, sector:'rettifica', owner:'', note:'', due:''},
  { id:'info',title:'Informazioni',                      desc:'Segnaletica e informazioni visive chiare e aggiornate', s:4, v:0, sector:'rettifica', owner:'', note:'', due:''},
  { id:'plan',title:'Piano per sostenere il risultato',  desc:'Routine 5S, audit periodici e azioni correttive per mantenere gli standard', s:5, v:0, sector:'rettifica', owner:'', note:'', due:''}
];

function seedLine(name){
  return { id:crypto.randomUUID(), name, sector:'rettifica', items:JSON.parse(JSON.stringify(DEFAULT_ITEMS)), collapsed:false };
}
const Store = {
  load(){ try{ return JSON.parse(localStorage.getItem('skf5s:data')) || {lines:[seedLine('CH 2'), seedLine('CH 3')]}; }catch{ return {lines:[seedLine('CH 2')]}; } },
  save(d){ localStorage.setItem('skf5s:data', JSON.stringify(d)); }
};
let state = Store.load();

/* ---------- Helpers ---------- */
const $  = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));
const todayISO = ()=>new Date().toISOString().slice(0,10);
const sColor = s => [null,'#7c5cff','#ff4d4d','#f7b500','#28a745','#3b82f6'][s];

function score(v){ return v; } // 0/1/3/5
function percOk(line){
  const pts = line.items.filter(i=>i.sector===line.sector).map(i=>score(i.v));
  if(!pts.length) return 0;
  return Math.round(100*pts.reduce((a,b)=>a+b,0)/(5*pts.length));
}
function percS(line,s){
  const arr=line.items.filter(i=>i.sector===line.sector && i.s===s).map(i=>score(i.v));
  if(!arr.length) return 0;
  return Math.round(100*arr.reduce((a,b)=>a+b,0)/(5*arr.length));
}
function dominantS(line){
  const m={1:0,2:0,3:0,4:0,5:0};
  line.items.filter(i=>i.sector===line.sector).forEach(i=>m[i.s]+=score(i.v));
  let ds=1,max=-1; for(const k of [1,2,3,4,5]){ if(m[k]>max){max=m[k]; ds=k;} }
  const tot = Object.values(m).reduce((a,b)=>a+b,0)||1;
  return {s:ds,p:Math.round(100*m[ds]/tot)};
}
function lateCount(line){
  return line.items.filter(i=>i.sector===line.sector && i.due && i.due<todayISO() && i.v<5).length;
}
function escapeHtml(s){return (s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"\'":'&#39;' }[m]));}
function escapeAttr(s){return (s||'').replace(/"/g,'&quot;')}

/* ---------- Render ---------- */
const selLine = $('#selLine'), areasEl = $('#areas'), tabList = $('#tabList');
function renderAll(){
  selLine.innerHTML = `<option value="">Linea: Tutte</option>` + state.lines.map(l=>`<option value="${l.id}">${l.name}</option>`).join('');
  tabList.innerHTML = `<button class="tab active" data-tab="">Tutte</button>` + state.lines.map(l=>`<button class="tab" data-tab="${l.id}">${l.name}</button>`).join('');

  const q = $('#q').value.toLowerCase();
  const lf = selLine.value;
  const mode = document.querySelector('.segmented .seg.active').dataset.mode;
  const onlyLate = $('#onlyLate').checked;

  areasEl.innerHTML = '';
  for(const line of state.lines){
    if(lf && line.id!==lf) continue;
    if(mode!=='all' && line.sector!==mode) continue;

    const items = line.items.filter(i=>{
      if(i.sector!==line.sector) return false;
      const txt = (i.title+' '+i.desc+' '+i.owner+' '+i.note).toLowerCase();
      const okQ = !q || txt.includes(q);
      const okLate = !onlyLate || (i.due && i.due<todayISO() && i.v<5);
      return okQ && okLate;
    });

    const html = `
      <section class="area" data-id="${line.id}">
        <div class="area-head">
          <input class="area-name inp" value="${line.name}">
          <div class="tab5s">
            <button class="seg ${line.sector==='rettifica'?'active':''}" data-sector="rettifica">Rettifica</button>
            <button class="seg ${line.sector==='montaggio'?'active':''}" data-sector="montaggio">Montaggio</button>
          </div>
          <div class="pills">
            <span class="pill s1">1S ${percS(line,1)}%</span>
            <span class="pill s2">2S ${percS(line,2)}%</span>
            <span class="pill s3">3S ${percS(line,3)}%</span>
            <span class="pill s4">4S ${percS(line,4)}%</span>
            <span class="pill s5">5S ${percS(line,5)}%</span>
          </div>
          <div class="btnline">
            <button class="btn add">+ Voce</button>
            <button class="btn collapse">${line.collapsed?'Espandi':'Comprimi'}</button>
            <button class="btn danger remove">Elimina</button>
          </div>
        </div>

        <div class="area-badges" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="badge">Punteggio: ${percOk(line)}%</span>
          <span class="badge">Predominante: ${dominantS(line).s}S ${dominantS(line).p}%</span>
        </div>

        <div class="items ${line.collapsed?'hide':''}">
          ${items.map(renderItem).join('')}
        </div>
      </section>
    `;
    areasEl.insertAdjacentHTML('beforeend', html);
  }

  updateKpiChart();
}
function renderItem(i){
  const late = (i.due && i.due<todayISO() && i.v<5) ? 'late' : '';
  return `
  <div class="item ${late}" data-item="${i.id}">
    <div class="item-head">
      <span class="tag tag-${i.s}s">${i.s}S</span>
      <div class="item-title">${escapeHtml(i.title)}</div>
      <div class="dots">
        ${[0,1,3,5].map(v=>`<div class="dot" role="button" tabindex="0" data-v="${v}" title="Punteggio ${v}">${v}</div>`).join('')}
      </div>
    </div>
    <div class="item-body">
      <input class="inp owner" placeholder="Responsabile" value="${escapeAttr(i.owner)}">
      <input class="inp due" type="date" value="${i.due||''}">
      <input class="inp note" placeholder="Note…" value="${escapeAttr(i.note)}">
    </div>
    <div class="item-foot" style="margin-top:8px;display:flex;gap:8px">
      <button class="btn info" data-info="${escapeAttr(i.desc)}">i</button>
      <button class="btn del">Elimina voce</button>
    </div>
  </div>`;
}

/* ---------- KPI + CHART ---------- */
let chart;
function updateKpiChart(){
  const mode = document.querySelector('.segmented .seg.active').dataset.mode;
  const lines = state.lines.filter(l=>mode==='all'||l.sector===mode);

  // KPI
  $('#kpiLines').textContent = lines.length;
  const arr = lines.map(percOk);
  $('#kpiAvg').textContent = arr.length? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length)+'%' : '0%';
  $('#kpiLate').textContent = lines.reduce((a,l)=>a+lateCount(l),0);

  // Chart
  const labels = lines.map(l=>l.name);
  const stacked = $('#stacked').checked;

  const datasets = stacked
    ? [1,2,3,4,5].map(s=>({label:`${s}S`, backgroundColor:sColor(s), data:lines.map(l=>percS(l,s)), borderWidth:0}))
    : [{label:'Totale', backgroundColor:'#8893a8', data:lines.map(l=>percOk(l)), borderWidth:0}];

  // larghezza canvas dinamica
  const minBar = stacked ? 80 : 70;
  const w = Math.max(520, labels.length * minBar);
  const canvas = document.getElementById('chart');
  canvas.style.width = w + 'px';

  const themeDark = document.documentElement.dataset.theme==='dark';
  const axisColor = themeDark ? '#b7c0cc' : '#6b7785';

  if(!chart){
    const ctx = canvas.getContext('2d');
    Chart.register(ChartDataLabels);
    chart = new Chart(ctx,{
      type:'bar',
      data:{labels, datasets},
      options:{
        responsive:true,
        maintainAspectRatio:false,
        layout:{padding:{top:8}},
        scales:{
          x:{stacked:stacked,ticks:{color:axisColor,maxRotation:0,autoSkip:false},grid:{display:false}},
          y:{stacked:stacked,beginAtZero:true,max:100,ticks:{color:axisColor,callback:(v)=>v+'%'}}
        },
        plugins:{
          legend:{position:'top', labels:{color:axisColor}},
          tooltip:{enabled:true, callbacks:{label:(ctx)=>`${ctx.dataset.label}: ${ctx.raw}%`}},
          datalabels:{
            formatter:(v)=> (v>= (stacked?8:5)) ? `${v}%` : '',
            anchor:(ctx)=> stacked?'center':'end',
            align:(ctx)=> stacked?'center':'end',
            offset:(ctx)=> stacked?0:2,
            color:(ctx)=>{
              if(!stacked) return themeDark ? '#e6edf6' : '#0b2540';
              return ctx.dataset.label.startsWith('3S') ? '#222' : '#fff';
            },
            font:{weight:'700'}
          }
        }
      }
    });
  }else{
    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.options.scales.x.stacked = stacked;
    chart.options.scales.y.stacked = stacked;
    chart.update();
  }

  // badge elenco linee
  $('#legend-badges').innerHTML = lines.map(l=>`<span class="badge">${l.name}</span>`).join('');
}

/* ---------- Eventi globali ---------- */
$('#btnNew').addEventListener('click', ()=>{
  const name = prompt('Nome linea (es. CH 4):','CH '+(state.lines.length+2));
  if(!name) return;
  state.lines.push(seedLine(name));
  Store.save(state); renderAll();
});
$('#btnExport').addEventListener('click', ()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(state)],{type:'application/json'}));
  a.download='SKF-5S.json'; a.click();
});
$('#btnImport').addEventListener('click',()=>{
  const i=document.createElement('input'); i.type='file'; i.accept='application/json';
  i.onchange=async()=>{ state=JSON.parse(await i.files[0].text()); Store.save(state); renderAll(); };
  i.click();
});
$('#btnPrint').addEventListener('click',()=>window.print());

$('#btnClear').addEventListener('click', ()=>{
  $('#q').value=''; selLine.value=''; $('#onlyLate').checked=false;
  $$('.segmented .seg').forEach(b=>b.classList.remove('active'));
  document.querySelector('.segmented .seg[data-mode="all"]').classList.add('active');
  renderAll();
});

$('#q').addEventListener('input', renderAll);
selLine.addEventListener('change', renderAll);
$$('.segmented .seg').forEach(b=>b.addEventListener('click',()=>{
  $$('.segmented .seg').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); renderAll();
}));
$('#onlyLate').addEventListener('change', renderAll);
$('#stacked').addEventListener('change', renderAll);
$('#zoomIn').addEventListener('click',()=>zoom(1.1));
$('#zoomOut').addEventListener('click',()=>zoom(0.9));
function zoom(k){
  const c=$('#chart'); const h=Math.max(160, Math.min(600, c.height*k));
  c.height=h; if(chart) chart.resize();
}

$('#btnCollapseAll').addEventListener('click', ()=>{ state.lines.forEach(l=>l.collapsed=true); Store.save(state); renderAll(); });
$('#btnExpandAll').addEventListener('click',   ()=>{ state.lines.forEach(l=>l.collapsed=false); Store.save(state); renderAll(); });

/* Delegation aree */
areasEl.addEventListener('click',(e)=>{
  const area=e.target.closest('.area'); if(!area) return;
  const line=state.lines.find(l=>l.id===area.dataset.id);

  if(e.target.matches('.tab5s .seg')){
    line.sector=e.target.dataset.sector; Store.save(state); renderAll(); return;
  }
  if(e.target.classList.contains('add')){
    line.items.push({id:crypto.randomUUID(),title:'Nuova voce',desc:'',s:1,v:0,sector:line.sector,owner:'',note:'',due:''});
    Store.save(state); renderAll(); return;
  }
  if(e.target.classList.contains('collapse')){
    line.collapsed=!line.collapsed; Store.save(state); renderAll(); return;
  }
  if(e.target.classList.contains('remove')){
    if(confirm('Eliminare la linea?')){ state.lines=state.lines.filter(l=>l.id!==line.id); Store.save(state); renderAll(); }
    return;
  }

  const dot=e.target.closest('.dot');
  if(dot){
    const itEl=e.target.closest('.item'); const item=line.items.find(i=>i.id===itEl.dataset.item);
    item.v=parseInt(dot.dataset.v,10); Store.save(state); renderAll(); return;
  }
  if(e.target.classList.contains('info')){
    $('#infoText').textContent = e.target.dataset.info || '';
    $('#infoDlg').showModal();
    return;
  }
  if(e.target.classList.contains('del')){
    const itEl=e.target.closest('.item'); line.items=line.items.filter(i=>i.id!==itEl.dataset.item);
    Store.save(state); renderAll(); return;
  }
});
areasEl.addEventListener('input',(e)=>{
  const area=e.target.closest('.area'); if(!area) return;
  const line=state.lines.find(l=>l.id===area.dataset.id);

  if(e.target.classList.contains('area-name')){ line.name=e.target.value.trim()||line.name; Store.save(state); renderAll(); return; }

  const itEl=e.target.closest('.item'); if(!itEl) return;
  const item=line.items.find(i=>i.id===itEl.dataset.item);
  if(e.target.classList.contains('owner')) item.owner=e.target.value;
  if(e.target.classList.contains('note'))  item.note =e.target.value;
  if(e.target.classList.contains('due'))   item.due  =e.target.value;
  Store.save(state); renderAll();
});
$('#infoClose').addEventListener('click',()=>$('#infoDlg').close());

/* Start */
renderAll();
