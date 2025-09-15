/* ===================================================================
   SKF 5S – App (v7.15.3)
   =================================================================== */

/* --------- Utils --------- */
const $  = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const fmtPct = v => `${Math.round(v)}%`;

/* --------- DOM refs (declare once!) --------- */
const selLine     = $('#selLine');
const areasEl     = $('#areas');            // <— unico punto di dichiarazione
const linePills   = $('#linePills');
const txtSearch   = $('#txtSearch');
const chkLate     = $('#chkLate');
const chkStacked  = $('#chkStacked');
const btnZoomIn   = $('#btnZoomIn');
const btnZoomOut  = $('#btnZoomOut');
const btnNew      = $('#btnNew');
const btnExport   = $('#btnExport');
const fileImport  = $('#fileImport');
const btnClear    = $('#btnClear');
const btnCollapseAll = $('#btnCollapseAll');
const btnExpandAll   = $('#btnExpandAll');
const segSector   = $('#segSector');
const kpiLines    = $('#kpiLines');
const kpiAvg      = $('#kpiAvg');
const kpiLate     = $('#kpiLate');

/* --------- Costanti / colori 5S --------- */
const S_COLORS = {
  '1S':'#7b61ff','2S':'#ea4335','3S':'#f9ab00','4S':'#34a853','5S':'#4285f4','Tot':'#6b7c93'
};
const S_ORDER = ['1S','2S','3S','4S','5S'];

/* --------- Voci default (estratto sintetico) --------- */
const VOC = {
  '1S': [
    {t:'1-S Stato', d:'Selezione del necessario. Superfluo rimosso.'},
    {t:'Sicurezza', d:'Area libera da ostacoli/pericoli di inciampo.'},
    {t:'Qualità', d:'Materiali buoni separati dagli scarti.'},
    {t:'Pulizia', d:'Punto di raccolta/ordini definito.'}
  ],
  '2S': [
    {t:'Postazioni', d:'Tutto al suo posto, segnaletica chiara.'},
    {t:'Etichette', d:'Ombre/etichette per posizioni a terra o quota.'}
  ],
  '3S': [
    {t:'Pulizia', d:'Pulizia costante, rimozione cause dello sporco.'}
  ],
  '4S': [
    {t:'Standard', d:'Regole e segnali visivi chiari.'}
  ],
  '5S': [
    {t:'Audit', d:'Audit regolari, disciplina e abitudine.'}
  ]
};

/* --------- Stato --------- */
let state = load() || {
  ver: '7.15.3',
  stacked: false,
  zoom: 1,
  sector: 'all',     // all | rettifica | montaggio
  lines: [
    makeLine('CH 2'),
    makeLine('CH 3')
  ]
};

/* --------- Chart --------- */
let chart;
const ctx = $('#chart').getContext('2d');
function buildChart(){
  if (chart) chart.destroy();

  const visibleLines = getFilteredLines();
  const labels = visibleLines.map(l=>l.name);
  const stacked = state.stacked;

  // dataset: o “Totale” oppure 5S separati
  let datasets;
  if (stacked){
    datasets = S_ORDER.map(s => ({
      label:s,
      backgroundColor: S_COLORS[s],
      data: visibleLines.map(l => scoreByS(l)[s] || 0),
      stack:'s'
    }));
  } else {
    datasets = [{
      label:'Tot',
      backgroundColor: S_COLORS.Tot,
      data: visibleLines.map(l => totalScore(l))
    }];
  }

  chart = new Chart(ctx, {
    type:'bar',
    data:{labels,datasets},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        y:{min:0,max:100,ticks:{stepSize:25}},
        x:{ticks:{color:'#5b6b7b'}}
      },
      plugins:{
        legend:{
          display: stacked,
          labels:{boxWidth:12,color:'#4a5a6a'}
        },
        tooltip:{
          callbacks:{
            label: (ctx)=>{
              const v = ctx.raw ?? 0;
              if (stacked) return `${ctx.dataset.label}: ${fmtPct(v)}`;
              return `Totale: ${fmtPct(v)}`;
            }
          }
        }
      }
    }
  });
}

/* --------- Rendering aree --------- */
function renderAll(){
  // Populate select linea e pill sotto grafico
  selLine.innerHTML = `<option value="*">Linea: Tutte</option>` + state.lines.map((l,i)=>(
    `<option value="${i}">${l.name}</option>`
  )).join('');

  linePills.innerHTML = state.lines.map((l,i)=>{
    return `<button class="pill" data-line-pill="${i}" style="border-color:#cbd5e1">
      ${l.name}
    </button>`;
  }).join('');

  // KPI
  const linesVis = getFilteredLines();
  kpiLines.textContent = linesVis.length;
  const avg = linesVis.length ? (linesVis.map(totalScore).reduce((a,b)=>a+b,0)/linesVis.length) : 0;
  kpiAvg.textContent = fmtPct(avg);
  kpiLate.textContent = totalLate(linesVis);

  // Chart
  buildChart();

  // Aree
  areasEl.innerHTML = '';
  getFilteredLines().forEach((line, idx) => {
    areasEl.appendChild(renderArea(line, idx));
  });

  // Aggiorna stacked checkbox
  chkStacked.checked = state.stacked;
}

function renderArea(line, idx){
  const tpl = $('#tpl-area').content.cloneNode(true);
  const el  = tpl.querySelector('.area');
  el.dataset.line = idx;

  const nameInput = el.querySelector('.area__name');
  nameInput.value = line.name;
  nameInput.addEventListener('input', e=>{
    line.name = e.target.value || `CH ${idx+1}`;
    save(); renderAll();
  });

  // settore toggle
  const seg = el.querySelector('.area__sector');
  $$('[data-sector]', seg).forEach(b=>{
    if (b.dataset.sector === line.sector) b.classList.add('active');
    b.addEventListener('click', ()=>{
      line.sector = b.dataset.sector;
      $$('[data-sector]', seg).forEach(x=>x.classList.toggle('active', x===b));
      save(); renderAll();
    });
  });

  // score badges
  const sMap = scoreByS(line);
  S_ORDER.forEach(s=>{
    const b = el.querySelector(`[data-badge="${s}"] b`);
    b.textContent = fmtPct(sMap[s]||0);
  });
  el.querySelector('.js-score').textContent = fmtPct(totalScore(line));
  el.querySelector('.js-dom').textContent = dominantS(line) || '—';

  // actions header
  el.querySelector('.js-add').addEventListener('click', ()=>{
    addItem(line, suggestS(line));
    save(); renderAll();
  });
  el.querySelector('.js-toggle').addEventListener('click', (ev)=>{
    const body = el.querySelector('.items');
    const collapsed = body.hasAttribute('hidden');
    body.toggleAttribute('hidden', !collapsed);
    ev.currentTarget.textContent = collapsed ? 'Comprimi' : 'Espandi';
  });
  el.querySelector('.js-del').addEventListener('click', ()=>{
    if (!confirm(`Eliminare la linea "${line.name}"?`)) return;
    state.lines.splice(idx,1);
    save(); renderAll();
  });

  // items
  const itemsWrap = el.querySelector('.items');
  line.items.forEach((it,itx)=>{
    itemsWrap.appendChild(renderItem(line, it, itx));
  });

  return el;
}

function renderItem(line, it, itx){
  const tpl = $('#tpl-item').content.cloneNode(true);
  const el  = tpl.querySelector('.item');

  const tit = el.querySelector('.item__title');
  tit.value = it.t; tit.addEventListener('input', e=>{ it.t=e.target.value; save(); });

  // desc (info toggle)
  const descBox = el.querySelector('.item__desc');
  descBox.textContent = it.d || '—';
  el.querySelector('.info').addEventListener('click', ()=>{
    const vis = descBox.style.display==='block';
    descBox.style.display = vis ? 'none':'block';
  });

  // points
  const pts = el.querySelector('.points');
  $$('[data-pt]', pts).forEach(btn=>{
    const val = +btn.dataset.pt;
    if (val === it.pt) btn.classList.add('active');
    btn.addEventListener('click', ()=>{
      it.pt = val;
      // aggiorna UI punti
      $$('[data-pt]', pts).forEach(x=>x.classList.toggle('active', +x.dataset.pt===val));
      save(); renderAll();           // aggiorno subito score e badge
    });
  });

  // meta
  const resp = el.querySelector('.resp'); resp.value = it.r || '';
  resp.addEventListener('input', e=>{it.r=e.target.value; save();});

  const date = el.querySelector('.date'); date.value = it.dt || '';
  date.addEventListener('input', e=>{it.dt=e.target.value; save();});

  const note = el.querySelector('.note'); note.value = it.n || '';
  note.addEventListener('input', e=>{it.n=e.target.value; save();});

  el.querySelector('.js-remove').addEventListener('click', ()=>{
    if (!confirm('Eliminare questa voce?')) return;
    line.items.splice(itx,1);
    save(); renderAll();
  });

  return el;
}

/* --------- Model helpers --------- */
function makeLine(name='CH'){
  // default 1 voce per ciascuna S
  const items = [];
  S_ORDER.forEach(s=>{
    const v = (VOC[s] && VOC[s][0]) ? VOC[s][0] : {t:`${s} voce`, d:''};
    items.push({s, t:v.t, d:v.d, pt:0, r:'', dt:'', n:''});
  });
  return {name, sector:'rettifica', items};
}
function addItem(line, s='1S'){
  const v = (VOC[s] && VOC[s][0]) ? VOC[s][0] : {t:`${s} voce`, d:''};
  line.items.push({s, t:v.t, d:v.d, pt:0, r:'', dt:'', n:''});
}
function suggestS(line){
  // suggerisci la S meno coperta
  const map = scoreByS(line);
  let minS=S_ORDER[0], minV=map[minS]||0;
  S_ORDER.forEach(s=>{ const v=map[s]||0; if (v<minV){minS=s;minV=v;}});
  return minS;
}

function scoreByS(line){
  const map = { '1S':0,'2S':0,'3S':0,'4S':0,'5S':0 };
  const cnt = { '1S':0,'2S':0,'3S':0,'4S':0,'5S':0 };
  line.items.forEach(it=>{ if(S_ORDER.includes(it.s)){ cnt[it.s]++; map[it.s]+=ptToPct(it.pt); } });
  S_ORDER.forEach(s=>{ if (cnt[s]) map[s] = map[s]/cnt[s]; });
  return map;
}
function ptToPct(pt){
  // mappa 0/1/3/5 su 0/25/60/100 (taratura “dolce”)
  return pt===5?100 : pt===3?60 : pt===1?25 : 0;
}
function totalScore(line){
  const m = scoreByS(line);
  const arr = S_ORDER.map(s=>m[s]||0);
  return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
}
function dominantS(line){
  const m = scoreByS(line);
  let maxS=null, maxV=-1;
  S_ORDER.forEach(s=>{const v=m[s]||0; if(v>maxV){maxV=v;maxS=s;}});
  return maxV<=0 ? null : `${maxS} ${fmtPct(maxV)}`;
}
function totalLate(lines){
  // “in ritardo” se dt valorizzata < data odierna e pt < 100
  const now = new Date().toISOString().slice(0,10);
  let c=0;
  lines.forEach(l=>l.items.forEach(it=>{
    if (it.dt && it.dt < now && ptToPct(it.pt)<100) c++;
  }));
  return c;
}

/* --------- Filtering --------- */
function getFilteredLines(){
  const q = txtSearch.value.trim().toLowerCase();
  const lineSel = selLine.value; // "*" oppure index
  const sector = state.sector;   // all|rettifica|montaggio
  const lateOnly = chkLate.checked;

  let arr = state.lines;

  if (lineSel !== '*') arr = arr.filter((_,i)=> String(i)===lineSel);
  if (sector !== 'all') arr = arr.filter(l => l.sector===sector);
  if (q){
    arr = arr.filter(l=>{
      const hitLine = l.name.toLowerCase().includes(q);
      const hitItems = l.items.some(it =>
        [it.t,it.d,it.n,it.r].some(x=> String(x||'').toLowerCase().includes(q))
      );
      return hitLine || hitItems;
    });
  }
  if (lateOnly){
    const now = new Date().toISOString().slice(0,10);
    arr = arr.filter(l => l.items.some(it => it.dt && it.dt < now && ptToPct(it.pt)<100));
  }
  return arr;
}

/* --------- Persistenza --------- */
function save(){ localStorage.setItem('skf5s', JSON.stringify(state)); }
function load(){
  try{ return JSON.parse(localStorage.getItem('skf5s')); }
  catch(_){ return null; }
}

/* --------- Event wiring --------- */

// Tema
$('#btnTheme').addEventListener('click', ()=>{
  document.documentElement.classList.toggle('dark');
});

// Nuova linea
btnNew.addEventListener('click', ()=>{
  state.lines.push(makeLine(`CH ${state.lines.length+1}`));
  save(); renderAll();
});
// Export / Import
btnExport.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a = Object.assign(document.createElement('a'), {download:'SKF-5S.json', href:URL.createObjectURL(blob)});
  a.click(); URL.revokeObjectURL(a.href);
});
fileImport.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const txt = await f.text();
  state = JSON.parse(txt);
  save(); renderAll();
  e.target.value='';
});

// Filtri base
[txtSearch, selLine, chkLate].forEach(el => el.addEventListener('input', ()=>renderAll()));
btnClear.addEventListener('click', ()=>{
  txtSearch.value=''; selLine.value='*'; chkLate.checked=false;
  state.sector='all'; $$('.seg__btn', segSector).forEach(b=>b.classList.toggle('active', b.dataset.sector==='all'));
  renderAll();
});

// Settore quick
segSector.addEventListener('click', (e)=>{
  const b = e.target.closest('.seg__btn'); if(!b) return;
  $$('.seg__btn', segSector).forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  state.sector = b.dataset.sector;
  renderAll();
});

// Pills linee (sotto chart)
linePills.addEventListener('click', (e)=>{
  const b = e.target.closest('[data-line-pill]'); if(!b) return;
  selLine.value = b.dataset.linePill;
  renderAll();
});

// Stacked + zoom
chkStacked.addEventListener('change', ()=>{ state.stacked = chkStacked.checked; save(); buildChart(); });
btnZoomIn.addEventListener('click', ()=> zoomChart(1));
btnZoomOut.addEventListener('click', ()=> zoomChart(-1));
function zoomChart(delta){
  state.zoom = Math.max(0.6, Math.min(2, state.zoom + delta*0.1));
  $('#chart').parentElement.style.transform = `scale(${state.zoom})`;
}

// Batch expand / collapse
btnCollapseAll.addEventListener('click', ()=>{
  $$('.area .items').forEach(x=>x.setAttribute('hidden',''));
  $$('.area .js-toggle').forEach(b=>b.textContent='Espandi');
});
btnExpandAll.addEventListener('click', ()=>{
  $$('.area .items').forEach(x=>x.removeAttribute('hidden'));
  $$('.area .js-toggle').forEach(b=>b.textContent='Comprimi');
});

// Delegation click su aree (NO seconda dichiarazione di areasEl!)
areasEl.addEventListener('click', (e)=>{
  // cambiare S associata ad una voce (clic sul badge 1S..5S non presente qui: le S sono nel data della voce)
  // Questo delegato resta per eventuali estensioni future
});

// Init
renderAll();
