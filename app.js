/* ================= SKF 5S – App logic (v7.9.5) ===================== */
/* Modifiche:
   - Etichette chart stacked/non-stacked leggibili (datalabels con padding/anchor/snap)
   - Versione in footer
   - KPI evidenti e pill predominate
*/

const APP_VERSION = 'v7.9.5';
document.getElementById('appVersion').textContent = APP_VERSION;

Chart.register(ChartDataLabels);

const COLORS = {
  s1: getCss('--s1'),
  s2: getCss('--s2'),
  s3: getCss('--s3'),
  s4: getCss('--s4'),
  s5: getCss('--s5'),
  text: getCss('--text')
};

function getCss(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

// ------------------ Stato & Dati ------------------
const LS_KEY = 'skf5s.v2';
let state = load() || seed();

function seed(){
  // Dati di esempio: linea CH 2 e CH 3
  return {
    theme: 'light',
    lines: [
      mkArea('CH 2'),
      mkArea('CH 3'),
    ]
  };
}

function mkArea(name){
  return {
    id: crypto.randomUUID(),
    name,
    sector: 'rettifica',
    items: [
      mkItem('1-S Stato'),
      mkItem('Sicurezza'),
      mkItem('Qualità'),
      mkItem('Pulizia'),
    ],
    collapsed: false
  };
}
function mkItem(title){
  return {
    id: crypto.randomUUID(),
    title,
    points: 0, // 0|1|3|5
    responsible: '',
    due: '',
    note: '',
    s: guessS(title) // 1..5
  };
}
function guessS(title){
  const map = [
    {k:'stato', s:1}, {k:'selezion', s:1},
    {k:'sistem', s:2}, {k:'posto', s:2},
    {k:'puliz', s:3},  {k:'splend', s:3},
    {k:'standard', s:4}, {k:'regole', s:4},
    {k:'sosten', s:5}, {k:'discipl', s:5}
  ];
  const t = title.toLowerCase();
  for (const m of map) if (t.includes(m.k)) return m.s;
  return 1;
}

function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function load(){ try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }

// ------------------ Utilities punteggi ------------------
function areaStats(area){
  // percentuali per S (1..5) considerando i punti 0/1/3/5
  const perS = {1:[],2:[],3:[],4:[],5:[]};
  for (const it of area.items) perS[it.s].push(it.points);
  const res = {byS:{}, avg:0, predom:{s:0,val:0}};
  let all = [];
  for(let s=1;s<=5;s++){
    const arr = perS[s];
    const sum = arr.reduce((a,b)=>a+b,0);
    const max = arr.length * 5 || 1;
    const perc = Math.round((sum/max)*100);
    res.byS[s] = perc;
    all = all.concat(arr);
  }
  const sumAll = all.reduce((a,b)=>a+b,0);
  const maxAll = (area.items.length*5)||1;
  res.avg = Math.round((sumAll/maxAll)*100);
  // predominante
  let bestS = 1, best = 0;
  for(let s=1;s<=5;s++){
    if (res.byS[s] > best){best = res.byS[s]; bestS = s;}
  }
  res.predom = {s:bestS, val:best};
  // late actions
  const now = new Date().toISOString().slice(0,10);
  res.late = area.items.filter(i => i.due && i.due < now && i.points<5).length;
  return res;
}

function globalStats(lines){
  const k = {avg:0, late:0};
  if (!lines.length) return {avg:0, late:0};
  let sum = 0;
  for (const a of lines){ const st = areaStats(a); sum += st.avg; k.late += st.late; }
  k.avg = Math.round(sum/lines.length);
  return k;
}

// ------------------ Rendering ------------------
const elSelLinea = document.getElementById('selLinea');
const elChkStacked = document.getElementById('chkStacked');
const elChkLate = document.getElementById('chkLate');
const elSearch = document.getElementById('txtSearch');
const elAreas = document.getElementById('areas');
const elBadgesRow = document.getElementById('badgesRow');

let chart;
renderAll();

function renderAll(){
  renderFilters();
  renderDashboard();
  renderAreaCards();
}

function renderFilters(){
  // linee dropdown
  elSelLinea.innerHTML = '<option value="all">Linea: Tutte</option>' +
    state.lines.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  // chips stato globali
  elBadgesRow.innerHTML = '';
  ['Tutte', ...state.lines.map(a=>a.name)].forEach((label, i) => {
    const b = document.createElement('button');
    b.className = 'badge' + (i===0?' active':'');
    b.textContent = label;
    b.dataset.filter = i===0 ? 'all' : label;
    b.addEventListener('click', ()=>{
      document.querySelectorAll('.badges-row .badge').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const id = i===0 ? 'all' : state.lines.find(x=>x.name===label)?.id;
      elSelLinea.value = id||'all';
      renderDashboard();
      renderAreaCards();
    });
    elBadgesRow.appendChild(b);
  });
}

function applyFilters(lines){
  const term = elSearch.value.trim().toLowerCase();
  const id = elSelLinea.value;
  let res = [...lines];
  if (id !== 'all') res = res.filter(a => a.id===id);
  // search su titolo/note/responsabile
  if (term){
    res = res.filter(a => a.items.some(i =>
      i.title.toLowerCase().includes(term) ||
      i.note.toLowerCase().includes(term) ||
      i.responsible.toLowerCase().includes(term)
    ));
  }
  if (elChkLate.checked){
    res = res.filter(a => areaStats(a).late>0);
  }
  // sector chip
  const activeSector = document.querySelector('.filter-chips .chip.active')?.dataset?.sector || 'all';
  if (activeSector!=='all') res = res.filter(a => a.sector===activeSector);
  return res;
}

function renderDashboard(){
  const lines = applyFilters(state.lines);
  // KPI
  document.getElementById('kpiLines').textContent = lines.length;
  const gs = globalStats(lines);
  document.getElementById('kpiAvg').textContent = gs.avg + '%';
  document.getElementById('kpiLate').textContent = gs.late;

  // chart
  const labels = lines.map(a=>a.name);
  const byS = [1,2,3,4,5].map(s => lines.map(a => areaStats(a).byS[s]));
  const stacked = elChkStacked.checked;

  const datasets = [
    {label:'1S', data:byS[0], backgroundColor:COLORS.s1},
    {label:'2S', data:byS[1], backgroundColor:COLORS.s2},
    {label:'3S', data:byS[2], backgroundColor:COLORS.s3},
    {label:'4S', data:byS[3], backgroundColor:COLORS.s4},
    {label:'5S', data:byS[4], backgroundColor:COLORS.s5}
  ];

  const ctx = document.getElementById('chartAreas').getContext('2d');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        datalabels:{
          color:'#fff',
          font:{weight:800, size:11},
          formatter:(v, ctx)=>{
            if (v<=0) return '';
            // in non-stacked mostra anche la S
            if (!stacked) return v+'%';
            return v+'%';
          },
          anchor: stacked ? 'end' : 'end',
          align: stacked ? 'end' : 'center',
          clamp:true,
          offset: stacked ? 2 : -12,
          padding: 2
        },
        tooltip:{
          callbacks:{
            title:(items)=> items[0].label,
            label:(c)=> `${c.dataset.label}: ${c.formattedValue}%`
          }
        }
      },
      scales:{
        x:{
          stacked, ticks:{color:COLORS.text, maxRotation:0, autoSkip:false, padding:8}
        },
        y:{
          stacked, beginAtZero:true, max:100,
          ticks:{color:COLORS.text, callback:(v)=>v+'%'}
        }
      },
      layout:{padding:{top: stacked? 14: 6}}
    }
  });
}

function renderAreaCards(){
  const lines = applyFilters(state.lines);
  elAreas.innerHTML = '';
  lines.forEach(a => {
    const st = areaStats(a);
    const card = document.createElement('div');
    card.className = 'area';
    card.innerHTML = `
      <div class="area__head">
        <div class="area__title">
          <input data-id="${a.id}" class="inpName" value="${a.name}" />
          <span class="pill">Settore:
            <select data-id="${a.id}" class="selSector">
              <option value="rettifica" ${a.sector==='rettifica'?'selected':''}>Rettifica</option>
              <option value="montaggio" ${a.sector==='montaggio'?'selected':''}>Montaggio</option>
            </select>
          </span>
        </div>
        <div class="pills">
          <span class="pill score">Punteggio: <b>${st.avg}%</b></span>
          <span class="pill predom">Predominante: <b>${st.predom.s}S ${st.predom.val}%</b></span>
          <button class="btn" data-act="add" data-id="${a.id}">+ Voce</button>
          <button class="btn" data-act="toggle" data-id="${a.id}">${a.collapsed ? 'Espandi' : 'Comprimi'}</button>
          <button class="btn" data-act="del" data-id="${a.id}" style="background:#ff4d6d;color:#fff;border-color:#ff4d6d">Elimina</button>
        </div>
      </div>
      <div class="area__body" ${a.collapsed?'style="display:none"':''}>
        ${renderItems(a)}
        ${renderSBadges(a)}
      </div>
    `;
    elAreas.appendChild(card);
  });

  // eventi card
  elAreas.querySelectorAll('.inpName').forEach(i => i.addEventListener('change', e=>{
    const a = state.lines.find(x=>x.id===e.target.dataset.id); a.name = e.target.value; save(); renderAll();
  }));
  elAreas.querySelectorAll('.selSector').forEach(i => i.addEventListener('change', e=>{
    const a = state.lines.find(x=>x.id===e.target.dataset.id); a.sector = e.target.value; save(); renderDashboard();
  }));
  elAreas.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.id;
    const a = state.lines.find(x=>x.id===id);
    const act = e.currentTarget.dataset.act;
    if (act==='add'){ a.items.push(mkItem('Nuova voce')); }
    if (act==='toggle'){ a.collapsed = !a.collapsed; }
    if (act==='del'){ if (confirm('Eliminare la linea?')) state.lines = state.lines.filter(x=>x.id!==id); }
    save(); renderAll();
  }));

  // dots click
  elAreas.querySelectorAll('.dot').forEach(d => d.addEventListener('click', e=>{
    const aId = e.currentTarget.dataset.aid;
    const iId = e.currentTarget.dataset.iid;
    const val = +e.currentTarget.dataset.v;
    const a = state.lines.find(x=>x.id===aId);
    const it = a.items.find(x=>x.id===iId);
    it.points = val;
    save();
    // aggiorna solo card + dashboard
    renderDashboard();
    renderAreaCards();
    // evidenzia causa ritardo / S predominante già aggiornati
  }));

  // meta input
  elAreas.querySelectorAll('.item input, .item textarea').forEach(el => el.addEventListener('change', e=>{
    const aId = e.target.closest('.item').dataset.aid;
    const iId = e.target.closest('.item').dataset.iid;
    const a = state.lines.find(x=>x.id===aId);
    const it = a.items.find(x=>x.id===iId);
    if (e.target.name==='responsible') it.responsible = e.target.value;
    if (e.target.name==='due') it.due = e.target.value;
    if (e.target.name==='note') it.note = e.target.value;
    save(); renderDashboard();
  }));
}

function renderItems(a){
  return a.items.map(it=>{
    const circle = v => `<span class="dot ${it.points===v?'active':''}" data-aid="${a.id}" data-iid="${it.id}" data-v="${v}">${v}</span>`;
    return `
      <div class="item" data-aid="${a.id}" data-iid="${it.id}">
        <div class="item__row">
          <div class="item__title">${it.title}</div>
          <div class="points">
            ${circle(0)} ${circle(1)} ${circle(3)} ${circle(5)}
          </div>
          <div class="item__meta">
            <input type="text" name="responsible" placeholder="Responsabile" value="${it.responsible||''}" />
            <input type="date"  name="due" value="${it.due||''}" />
          </div>
          <div class="item__meta" style="width:100%">
            <input type="text" name="note" style="width:100%" placeholder="Note…" value="${it.note||''}" />
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSBadges(a){
  const st = areaStats(a);
  const mk = (s, c) => `<span class="badge s${s} ${st.predom.s===s?'active':''}"> ${s}S <b>${st.byS[s]}%</b></span>`;
  return `<div class="pills">${mk(1,COLORS.s1)}${mk(2,COLORS.s2)}${mk(3,COLORS.s3)}${mk(4,COLORS.s4)}${mk(5,COLORS.s5)}</div>`;
}

// ------------------ Eventi globali ------------------
document.getElementById('btnNew').addEventListener('click', ()=>{
  const n = nextName();
  state.lines.push(mkArea(n));
  save(); renderAll();
});
function nextName(){
  // CH progressivo
  let i=2;
  while (state.lines.some(a=>a.name==='CH '+i)) i++;
  return 'CH '+i;
}

document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'SKF-5S-data.json';
  a.click();
});
document.getElementById('btnImport').addEventListener('click', ()=>{
  const i = document.createElement('input'); i.type='file'; i.accept='application/json';
  i.onchange = () => {
    const f = i.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = e => { state = JSON.parse(e.target.result); save(); renderAll(); };
    r.readAsText(f);
  };
  i.click();
});
document.getElementById('btnPrint').addEventListener('click', ()=>window.print());
document.getElementById('btnTheme').addEventListener('click', ()=>{
  // semplice toggle CSS prefers-color-scheme già gestito; qui potresti aggiungere classe
  document.documentElement.classList.toggle('force-dark');
  renderDashboard();
});

document.getElementById('btnClear').addEventListener('click', ()=>{
  elSearch.value=''; elSelLinea.value='all'; elChkLate.checked=false;
  document.querySelectorAll('.filter-chips .chip').forEach(c=>c.classList.toggle('active', c.dataset.sector==='all'));
  renderAll();
});

document.querySelectorAll('.filter-chips .chip').forEach(c=>c.addEventListener('click', ()=>{
  document.querySelectorAll('.filter-chips .chip').forEach(x=>x.classList.remove('active'));
  c.classList.add('active'); renderDashboard(); renderAreaCards();
}));

elSearch.addEventListener('input', ()=>{ renderDashboard(); renderAreaCards(); });
elSelLinea.addEventListener('change', ()=>{ renderDashboard(); renderAreaCards(); });
elChkLate.addEventListener('change', ()=>{ renderDashboard(); renderAreaCards(); });
elChkStacked.addEventListener('change', ()=>{ renderDashboard(); });

document.getElementById('btnZoomIn').addEventListener('click', ()=> zoom(1.1));
document.getElementById('btnZoomOut').addEventListener('click', ()=> zoom(0.9));
function zoom(mul){
  const c = document.getElementById('chartAreas');
  const h = c.height || 220;
  c.height = Math.max(160, Math.min(460, h*mul));
  chart?.resize();
}

document.getElementById('btnCollapseAll').addEventListener('click', ()=>{
  state.lines.forEach(a=>a.collapsed=true); save(); renderAreaCards();
});
document.getElementById('btnExpandAll').addEventListener('click', ()=>{
  state.lines.forEach(a=>a.collapsed=false); save(); renderAreaCards();
});
