/*  =========================================================
    SKF 5S — v7.9.8 (compatta + fix mobile + note textarea)
    ========================================================= */

Chart.register(ChartDataLabels);

// ---------- Stato & Costanti ----------
const LSKEY = 'skf5s_v2';
const COLORS = {
  '1S': getCSS('--c1'),
  '2S': getCSS('--c2'),
  '3S': getCSS('--c3'),
  '4S': getCSS('--c4'),
  '5S': getCSS('--c5'),
};
const S_ORDER = ['1S','2S','3S','4S','5S'];
const NOW = () => new Date().toISOString().slice(0,10);

let state = load();
let ui = {};
let chart;

// ---------- Utils ----------
function getCSS(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function save(){ localStorage.setItem(LSKEY, JSON.stringify(state)); }
function load(){
  try { return JSON.parse(localStorage.getItem(LSKEY)) || seed(); }
  catch { return seed(); }
}
function seed(){
  return {
    theme:'light',
    stacked:false,
    areas:[]
  };
}
function uid(){ return Math.random().toString(36).slice(2,9); }
function percent(part, tot){ return tot ? Math.round((part/tot)*100) : 0; }

// Calcolo punteggi 5S per area
function calcArea(area){
  // somma punti per S (p0=0, p1=1, p3=3, p5=5)
  let sums = {'1S':0,'2S':0,'3S':0,'4S':0,'5S':0};
  let counts = {'1S':0,'2S':0,'3S':0,'4S':0,'5S':0};

  for(const it of area.items){
    const v = it.score ?? 0; // 0/1/3/5
    sums[it.S] += v;
    counts[it.S] += 5; // massimo per item = 5
  }

  // percentuali per S
  const p = {};
  for(const s of S_ORDER){
    p[s] = counts[s] ? Math.round((sums[s]/counts[s])*100) : 0;
  }
  // punteggio totale area = media delle 5S
  const media = Math.round((p['1S']+p['2S']+p['3S']+p['4S']+p['5S'])/5);

  // predominante (S con valore più alto)
  let predS = '1S', predV = -1;
  for(const s of S_ORDER){ if(p[s] > predV){ predV = p[s]; predS = s; } }

  // azioni in ritardo
  const late = area.items.filter(it => it.due && it.due < NOW()).length;

  return {p, media, predS, predV, late};
}

// ---------- Rendering ----------
window.addEventListener('DOMContentLoaded', () => {
  bindUI();
  renderAll();
});

function bindUI(){
  ui.q = byId('q');
  ui.lineFilter = byId('lineFilter');
  ui.lateOnly = byId('lateOnly');
  ui.stacked = byId('stacked');
  ui.kpiLines = byId('kpiLines');
  ui.kpiAvg   = byId('kpiAvg');
  ui.kpiLate  = byId('kpiLate');
  ui.zoomIn = byId('zoomIn');
  ui.zoomOut = byId('zoomOut');
  ui.chart = byId('chart');
  ui.lineBadges = byId('lineBadges');
  ui.areas = byId('areas');

  // Barra settori rapidi
  document.querySelectorAll('.sector .tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.sector .tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.quickSector = btn.dataset.sector; save(); renderAll();
    });
  });

  // Filtri
  ui.q.addEventListener('input', renderAll);
  ui.lineFilter.addEventListener('change', renderAll);
  ui.lateOnly.addEventListener('change', renderAll);
  ui.stacked.addEventListener('change', ()=>{ state.stacked = ui.stacked.checked; save(); renderChart(); });
  byId('btnClear').addEventListener('click', ()=>{
    ui.q.value=''; ui.lineFilter.value=''; ui.lateOnly.checked=false; renderAll();
  });

  // Top actions
  byId('btnTheme').addEventListener('click', toggleTheme);
  byId('btnNew').addEventListener('click', newArea);
  byId('btnExport').addEventListener('click', exportJSON);
  byId('btnImport').addEventListener('click', importJSON);
  byId('btnPrint').addEventListener('click', ()=>window.print());

  // Zoom chart
  let scale = 1;
  ui.zoomIn.addEventListener('click', ()=>{ scale=Math.min(2, scale+0.1); ui.chart.style.transform=`scale(${scale})`; ui.chart.style.transformOrigin='top left'; });
  ui.zoomOut.addEventListener('click', ()=>{ scale=Math.max(1, scale-0.1); ui.chart.style.transform=`scale(${scale})`; });

  // Bulk expand/collapse
  byId('collapseAll').addEventListener('click', ()=>{
    document.querySelectorAll('.area').forEach(a=>a.classList.add('collapsed'));
  });
  byId('expandAll').addEventListener('click', ()=>{
    document.querySelectorAll('.area').forEach(a=>a.classList.remove('collapsed'));
  });

  // Tema
  if(state.theme==='dark'){ document.documentElement.setAttribute('data-theme','dark'); }
  ui.stacked.checked = state.stacked || false;
  document.getElementById('version').textContent = 'v7.9.8';
}

function renderAll(){
  // popola select linee
  const lines = state.areas.map(a=>a.name).sort();
  ui.lineFilter.innerHTML = `<option value="">Linea: Tutte</option>` + lines.map(l=>`<option>${l}</option>`).join('');

  const filtered = state.areas.filter(a=>{
    if(ui.lineFilter.value && a.name!==ui.lineFilter.value) return false;
    if(ui.lateOnly.checked && calcArea(a).late===0) return false;
    const q = ui.q.value.trim().toLowerCase();
    if(!q) return true;
    return a.items.some(it=>
      (it.title||'').toLowerCase().includes(q) ||
      (it.note||'').toLowerCase().includes(q) ||
      (it.owner||'').toLowerCase().includes(q)
    );
  });

  // KPI
  ui.kpiLines.textContent = filtered.length;
  const medias = filtered.map(a=>calcArea(a).media);
  const avg = medias.length ? Math.round(medias.reduce((a,b)=>a+b,0)/medias.length) : 0;
  ui.kpiAvg.textContent = `${avg}%`;
  const lateTot = filtered.reduce((n,a)=>n+calcArea(a).late,0);
  ui.kpiLate.textContent = lateTot;

  // render chart + badges
  renderChart(filtered);
  renderBadges(filtered);

  // render areas
  renderAreas(filtered);
}

function renderChart(list=state.areas){
  const labels = list.map(a=>a.name);
  const dataByS = S_ORDER.map(S=>{
    return list.map(a=>calcArea(a).p[S]);
  });

  if(chart) chart.destroy();

  const stacked = ui.stacked.checked;

  chart = new Chart(ui.chart.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: S_ORDER.map((S,idx)=>({
        label: S,
        data: dataByS[idx],
        backgroundColor: hex(COLORS[S], 0.9),
        borderColor: COLORS[S],
        borderWidth: 1,
        stack: stacked ? 'stack' : undefined
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked, ticks:{ color:getCSS('--text') } },
        y: { stacked, beginAtZero:true, max:100, ticks:{ color:getCSS('--muted'), callback:v=>v+'%'} }
      },
      plugins: {
        legend: { display:false },
        datalabels: {
          color: '#fff',
          font: { weight: 800 },
          formatter: (v,ctx)=>{
            // Etichetta: percentuale + S quando non stacked
            if(!stacked && v>0){ return `${v}%`; }
            if(stacked && v>0){ return `${v}%`; }
            return '';
          },
          clamp:true,
          anchor:'end',
          align:'start',
          offset: 2
        },
        tooltip: {
          callbacks:{
            title: ctx => labels[ctx[0].dataIndex],
            label: ctx => `${ctx.dataset.label}: ${ctx.raw}%`
          }
        }
      }
    }
  });
}

function renderBadges(list){
  ui.lineBadges.innerHTML = '';
  const all = document.createElement('button');
  all.className='badge active';
  all.textContent='Tutte';
  all.addEventListener('click',()=>{ ui.lineFilter.value=''; renderAll(); });
  ui.lineBadges.appendChild(all);

  list.forEach(a=>{
    const b = document.createElement('button');
    b.className='badge';
    b.textContent=a.name;
    b.addEventListener('click',()=>{ ui.lineFilter.value=a.name; renderAll(); });
    ui.lineBadges.appendChild(b);
  });
}

function renderAreas(list){
  ui.areas.innerHTML = '';
  list.forEach(area=>{
    const calc = calcArea(area);

    const el = document.createElement('div');
    el.className='area';

    el.innerHTML = `
      <div class="area__head">
        <div class="area__title">Linea <strong>${area.name}</strong></div>
        <div class="scores">
          <span class="score s1">1S ${calc.p['1S']}%</span>
          <span class="score s2">2S ${calc.p['2S']}%</span>
          <span class="score s3">3S ${calc.p['3S']}%</span>
          <span class="score s4">4S ${calc.p['4S']}%</span>
          <span class="score s5">5S ${calc.p['5S']}%</span>
        </div>
        <div>
          <span class="badge">Punteggio: <strong>${calc.media}%</strong></span>
          <span class="badge">Predominante: <strong>${calc.predS} ${calc.predV}%</strong></span>
        </div>
        <div class="area__tabs">
          <button class="tab ${area.sector==='rettifica'?'active':''}" data-s="rettifica">Rettifica</button>
          <button class="tab ${area.sector==='montaggio'?'active':''}" data-s="montaggio">Montaggio</button>
        </div>
      </div>
      <div class="items"></div>
      <div class="area__foot" style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" data-act="add">+ Voce</button>
        <button class="btn" data-act="toggle">${el.classList.contains('collapsed')?'Espandi':'Comprimi'}</button>
        <button class="btn btn--danger" data-act="del">Elimina</button>
      </div>
    `;

    // Tab settore
    el.querySelectorAll('.area__tabs .tab').forEach(t=>{
      t.addEventListener('click',()=>{
        el.querySelectorAll('.area__tabs .tab').forEach(b=>b.classList.remove('active'));
        t.classList.add('active');
        area.sector = t.dataset.s;
        save(); renderAll();
      });
    });

    // Bottoni footer
    el.querySelector('[data-act="add"]').addEventListener('click', ()=>{
      area.items.push(blankItem());
      save(); renderAll();
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      if(confirm('Eliminare la linea?')){
        state.areas = state.areas.filter(a=>a!==area);
        save(); renderAll();
      }
    });
    el.querySelector('[data-act="toggle"]').addEventListener('click', (e)=>{
      el.classList.toggle('collapsed');
      e.target.textContent = el.classList.contains('collapsed')?'Espandi':'Comprimi';
    });

    // Voci
    const listEl = el.querySelector('.items');
    area.items.forEach(it=>{
      listEl.appendChild(renderItem(area, it));
    });

    ui.areas.appendChild(el);
  });
}

function renderItem(area, it){
  const row = document.createElement('div');
  row.className='item';

  // info
  const info = document.createElement('div');
  info.className='i';
  info.textContent='i';
  info.title = it.desc || '';
  row.appendChild(info);

  // titolo
  const title = document.createElement('input');
  title.type='text';
  title.value = it.title || '';
  title.placeholder = 'Descrizione…';
  title.oninput = () => { it.title = title.value; save(); };
  row.appendChild(title);

  // punti (0,1,3,5)
  const pts = document.createElement('div');
  pts.className='points';
  [0,1,3,5].forEach(v=>{
    const p = document.createElement('button');
    p.className = `point p${v} ${it.score===v?'active':''}`;
    p.textContent = v;
    p.style.borderColor = v===1?COLORS['1S'] : v===3?COLORS['3S'] : v===5?COLORS['5S'] : '#9aa5b1';
    p.addEventListener('click', ()=>{
      it.score = v; save();
      // evidenzia pulsante e aggiorna punteggi in tempo reale
      pts.querySelectorAll('.point').forEach(b=>b.classList.remove('active'));
      p.classList.add('active');
      renderAll();
    });
    pts.appendChild(p);
  });
  row.appendChild(pts);

  // scadenza + owner
  const due = document.createElement('input');
  due.type='date';
  due.value = it.due || '';
  due.onchange = ()=>{ it.due = due.value; save(); renderAll(); };

  const owner = document.createElement('input');
  owner.type='text';
  owner.placeholder='Responsabile';
  owner.value = it.owner || '';
  owner.oninput = ()=>{ it.owner = owner.value; save(); };

  const wrapMeta = document.createElement('div');
  wrapMeta.style.display='flex';
  wrapMeta.style.gap='8px';
  wrapMeta.append(due, owner);
  row.appendChild(wrapMeta);

  // NOTE (textarea ampia)
  const note = document.createElement('textarea');
  note.placeholder='Note…';
  note.className='note';
  note.rows = 3;
  note.value = it.note || '';
  note.oninput = ()=>{ it.note = note.value; save(); };
  row.appendChild(note);

  return row;
}

// ---------- Azioni di alto livello ----------
function newArea(){
  const n = prompt('Nome linea (es. CH 2):','CH 2');
  if(!n) return;
  state.areas.push({
    id: uid(),
    name: n,
    sector: 'rettifica',
    items: [
      blankItem('1-S Stato','1S'),
      blankItem('Sicurezza','1S'),
      blankItem('Qualità','1S'),
      blankItem('Pulizia','1S')
    ]
  });
  save(); renderAll();
}

function blankItem(title='Voce', s='1S'){
  return { id:uid(), title, desc:'', S:s, score:0, owner:'', due:'', note:'' };
}

function exportJSON(){
  const data = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url; a.download = 'SKF-5S.json'; a.click();
  URL.revokeObjectURL(url);
}

function importJSON(){
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='application/json';
  inp.onchange = () => {
    const f = inp.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => { state = JSON.parse(r.result); save(); renderAll(); };
    r.readAsText(f);
  };
  inp.click();
}

function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur==='dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  state.theme = next; save(); renderChart();
}

// Helpers
function byId(id){ return document.getElementById(id); }
function hex(h, alpha=1){
  // if already rgba return as is
  if(h.startsWith('rgba')||h.startsWith('rgb')) return h;
  // convert #rrggbb to rgba
  const r = parseInt(h.slice(1,3),16);
  const g = parseInt(h.slice(3,5),16);
  const b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
