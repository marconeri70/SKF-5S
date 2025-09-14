/* ================= SKF 5S – App (v7.9.7) ================= */
const APP_VERSION = 'v7.9.7';

/* ---------- Stato ---------- */
const state = {
  areas: [],              // [{id,line,sector,items[],collapsed,activeS}]
  filter: { search:'', line:'Tutte', sector:'all', onlyLate:false, stacked:false },
  chart: { inst:null, zoom:1 },
};

/* ---------- Dataset demo minimo (puoi poi importare i tuoi) ---------- */
function demoAreas(){
  return [
    mkArea('CH 2','rettifica'),
    mkArea('CH 3','montaggio'),
  ];
}
function mkArea(line, sector){
  // 4 voci d’esempio, una per ciascuna S
  const items = [
    { s:'1S', title:'1-S Stato', points:null, resp:'', due:'', note:'' },
    { s:'2S', title:'Sicurezza', points:null, resp:'', due:'', note:'' },
    { s:'3S', title:'Qualità', points:null, resp:'', due:'', note:'' },
    { s:'5S', title:'Pulizia', points:null, resp:'', due:'', note:'' },
  ];
  return { id:crypto.randomUUID(), line, sector, items, collapsed:false, activeS:'ALL' };
}

/* ---------- Utilità ---------- */
const S_COLORS = { '1S':'#7d5bd6','2S':'#e64a45','3S':'#f1b11a','4S':'#23a35a','5S':'#4597ff' };
const S_LIST = ['1S','2S','3S','4S','5S'];

function percent(n){ return isFinite(n)? Math.round(n) : 0; }
function byId(id){ return document.getElementById(id); }
function qs(sel,root=document){ return root.querySelector(sel); }
function qsa(sel,root=document){ return Array.from(root.querySelectorAll(sel)); }

/* ---------- Storage ---------- */
const LS_KEY = 'skf5s-data-v2';
function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw){ state.areas = demoAreas(); save(); return; }
    state.areas = JSON.parse(raw);
  }catch{ state.areas = demoAreas(); save(); }
}
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state.areas)); }

/* ---------- Score ---------- */
function computeAreaStats(area){
  const byS = { '1S':[], '2S':[], '3S':[], '4S':[], '5S':[] };
  area.items.forEach(it => byS[it.s]?.push(it.points ?? 0));

  const sPct = {};
  for(const s of S_LIST){
    const arr = byS[s];
    const max = arr.length*5 || 1;
    const sum = arr.reduce((a,b)=>a+(b||0),0);
    sPct[s] = 100 * (sum/max);
  }
  const all = Object.values(sPct);
  const avg = all.length ? all.reduce((a,b)=>a+b,0)/all.length : 0;

  // predominante
  let predS='1S', predV=-1;
  for(const s of S_LIST){ if(sPct[s]>predV){ predV=sPct[s]; predS=s; } }

  // ritardi
  const now = new Date().setHours(0,0,0,0);
  const late = area.items.some(it => it.due && new Date(it.due).setHours(0,0,0,0)<now && (it.points??0)<5);

  return { sPct, avg, predS, predV, late };
}

/* ---------- Filtri ---------- */
function applyFilters(){
  const {search,line,sector,onlyLate} = state.filter;
  const text = search.trim().toLowerCase();

  return state.areas.filter(a=>{
    if(line!=='Tutte' && a.line!==line) return false;
    if(sector!=='all' && a.sector!==sector) return false;

    const st = computeAreaStats(a);
    if(onlyLate && !st.late) return false;

    if(text){
      const t = [a.line,a.sector, ...a.items.map(i=>`${i.title} ${i.note??''} ${i.resp??''}`)].join(' ').toLowerCase();
      if(!t.includes(text)) return false;
    }
    return true;
  });
}

/* ---------- Render Dashboard ---------- */
function renderDashboard(){
  // drop e ricostruisci linea select + chip linee
  const lines = [...new Set(state.areas.map(a=>a.line))].sort((a,b)=>{
    const na=parseInt(a.replace(/\D/g,'')); const nb=parseInt(b.replace(/\D/g,'')); return na-nb;
  });
  const sel = byId('selLinea');
  sel.innerHTML = `<option value="Tutte">Linea: Tutte</option>` + lines.map(l=>`<option>${l}</option>`).join('');
  sel.value = state.filter.line;

  const filtered = applyFilters();

  // KPI
  byId('kpiLines').textContent = filtered.length;
  const avgs = filtered.map(a=>computeAreaStats(a).avg);
  byId('kpiAvg').textContent = (avgs.length?percent(avgs.reduce((a,b)=>a+b,0)/avgs.length):0) + '%';
  const lateCount = filtered.filter(a=>computeAreaStats(a).late).length;
  byId('kpiLate').textContent = lateCount;

  // badge linee
  const row = byId('badgesRow');
  row.innerHTML = '';
  if(lines.length){
    const all = document.createElement('button');
    all.className='chip'+(state.filter.line==='Tutte'?' active':'');
    all.textContent='Tutte';
    all.onclick=()=>{state.filter.line='Tutte'; renderAll();};
    row.appendChild(all);
  }
  lines.forEach(l=>{
    const b = document.createElement('button');
    b.className='chip'+(state.filter.line===l?' active':'');
    b.textContent=l;
    b.onclick=()=>{ state.filter.line = l; renderAll(); };
    row.appendChild(b);
  });

  renderChart(filtered);
}

/* ---------- Chart ---------- */
function renderChart(areas){
  const el = byId('chartAreas');
  const fb = byId('chartFallback');
  if(!(window.Chart && window.ChartDataLabels)){
    el.style.display='none'; fb.style.display='block'; return;
  }
  el.style.display='block'; fb.style.display='none';

  // dati per linee
  const labels = areas.map(a=>a.line);
  const dataByS = {};
  S_LIST.forEach(s=>dataByS[s]=areas.map(a=>computeAreaStats(a).sPct[s]));

  // distruggi precedente
  if(state.chart.inst){ state.chart.inst.destroy(); state.chart.inst=null; }

  const stacked = state.filter.stacked;
  const datasets = S_LIST.map(s=>({
    label:s, data:dataByS[s],
    backgroundColor:S_COLORS[s],
    borderColor:S_COLORS[s],
    borderWidth:1,
    datalabels:{
      color:'#fff', clamp:true, anchor: stacked?'center':'end', align: stacked?'center':'end',
      formatter:(v)=> v?`${percent(v)}%`:''
    }
  }));

  const cfg = {
    type:'bar',
    data:{ labels, datasets },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        x:{ stacked, ticks:{
          callback:(val,idx)=> labels[idx], // CH
        }},
        y:{ stacked, beginAtZero:true, max:100 }
      },
      plugins:{
        legend:{ display:true },
        datalabels:{ textStrokeColor:'rgba(0,0,0,.35)', textStrokeWidth:2 }
      }
    },
    plugins:[ChartDataLabels]
  };
  state.chart.inst = new Chart(el.getContext('2d'), cfg);

  // abbassa leggermente l’etichetta CH
  state.chart.inst.options.scales.x.ticks.padding = 10;
  state.chart.inst.update();
}

/* ---------- Render Aree (schede) ---------- */
function renderAreas(){
  const wr = byId('areas');
  wr.innerHTML='';
  const list = applyFilters();

  list.forEach(area=>{
    const st = computeAreaStats(area);

    const box = document.createElement('div');
    box.className='area';
    if(st.late) box.style.boxShadow = '0 0 0 3px rgba(231,76,60,.25)';

    /* HEAD */
    const head = document.createElement('div');
    head.className='area__head';

    const title = document.createElement('div');
    title.className='area__line';
    title.textContent = area.line;
    head.appendChild(title);

    // settore chips
    const sectors = document.createElement('div');
    sectors.className='sector-chips';
    ['rettifica','montaggio'].forEach(sec=>{
      const b=document.createElement('button');
      b.className='chip'+(area.sector===sec?' active':'');
      b.textContent=sec[0].toUpperCase()+sec.slice(1);
      b.onclick=()=>{ area.sector=sec; save(); renderAll(); };
      sectors.appendChild(b);
    });
    head.appendChild(sectors);

    // stats pill
    const stats = document.createElement('div');
    stats.className='area__stats';
    const pTot = document.createElement('div');
    pTot.className='stat-pill';
    pTot.innerHTML = `Punteggio: <b>${percent(st.avg)}%</b>`;
    const pPred = document.createElement('div');
    pPred.className='stat-pill';
    pPred.innerHTML = `Predominante: <span class="muted">${st.predS}</span> <b>${percent(st.predV)}%</b>`;
    stats.appendChild(pTot); stats.appendChild(pPred);

    const btnAdd = document.createElement('button'); btnAdd.className='btn'; btnAdd.textContent='+ Voce';
    btnAdd.onclick=()=>{ addItem(area); };
    const btnToggle = document.createElement('button'); btnToggle.className='btn';
    btnToggle.textContent= area.collapsed?'Espandi':'Comprimi';
    btnToggle.onclick=()=>{ area.collapsed=!area.collapsed; save(); renderAll(); };

    stats.appendChild(btnAdd); stats.appendChild(btnToggle);
    head.appendChild(stats);
    box.appendChild(head);

    /* TABS 5S */
    const tabs = document.createElement('div'); tabs.className='area__tabs';
    const tabAll = mkTab('ALL','Tutte', null, area);
    tabs.appendChild(tabAll);
    S_LIST.forEach(s=>{
      const t = mkTab(s, s, percent(st.sPct[s])+'%', area, s);
      tabs.appendChild(t);
    });
    box.appendChild(tabs);

    /* BODY */
    const body = document.createElement('div'); body.className='area__body';
    if(area.collapsed) body.style.display='none';

    const visibleS = area.activeS==='ALL'? null : area.activeS;
    area.items.forEach((it,idx)=>{
      if(visibleS && it.s!==visibleS) return;

      const row = document.createElement('div'); row.className='item';
      if(isLate(it)) row.classList.add('late');

      const info = document.createElement('div'); info.className='info'; info.textContent='i';
      row.appendChild(info);

      const title = document.createElement('div'); title.textContent = it.title; row.appendChild(title);

      const pts = document.createElement('div'); pts.className='points';
      [0,1,3,5].forEach(v=>{
        const p=document.createElement('div'); p.className='pt'; p.dataset.v=v; p.textContent=v;
        if(it.points===v) p.classList.add('active');
        p.onclick=()=>{ it.points=v; save(); renderAll(); };
        pts.appendChild(p);
      });
      row.appendChild(pts);

      const resp = document.createElement('input'); resp.placeholder='Responsabile'; resp.value=it.resp||''; resp.className='mono';
      resp.oninput=()=>{ it.resp=resp.value; save(); };
      row.appendChild(resp);

      const due = document.createElement('input'); due.type='date'; due.value=it.due||'';
      due.onchange=()=>{ it.due=due.value; save(); renderAll(); };
      row.appendChild(due);

      const note = document.createElement('input'); note.placeholder='Note…'; note.className='note'; note.value=it.note||'';
      note.oninput=()=>{ it.note=note.value; save(); };
      row.appendChild(note);

      body.appendChild(row);
    });
    box.appendChild(body);

    wr.appendChild(box);
  });

  function mkTab(kind, label, pct, area, s){
    const b = document.createElement('button');
    b.className = 'tab' + (s?(' '+s.toLowerCase()):'');
    if(area.activeS===kind) b.classList.add('active');
    b.innerHTML = (s?label:label) + (pct? ` <span class="pct">${pct}</span>` : '');
    b.onclick=()=>{ area.activeS=kind; save(); renderAll(); };
    return b;
  }

  function isLate(it){
    if(!it.due) return false;
    const d = new Date(it.due).setHours(0,0,0,0);
    return d < new Date().setHours(0,0,0,0) && (it.points??0) < 5;
  }
}

function addItem(area){
  area.items.push({ s:'1S', title:'Nuova voce', points:null, resp:'', due:'', note:'' });
  save(); renderAll();
}

/* ---------- Render All ---------- */
function renderAll(){
  byId('appVersion').textContent = APP_VERSION;
  renderDashboard();
  renderAreas();
}

/* ---------- Eventi UI ---------- */
function bindUI(){
  byId('btnTheme').onclick = ()=> document.documentElement.classList.toggle('dark');

  byId('txtSearch').oninput = e=>{ state.filter.search=e.target.value; renderAll(); };
  byId('selLinea').onchange = e=>{ state.filter.line=e.target.value; renderAll(); };
  byId('chkLate').onchange = e=>{ state.filter.onlyLate=e.target.checked; renderAll(); };

  // sector chips (filtri globali)
  qsa('#chipsSector .chip').forEach(ch=>{
    ch.onclick = ()=>{
      qsa('#chipsSector .chip').forEach(c=>c.classList.remove('active'));
      ch.classList.add('active');
      state.filter.sector = ch.dataset.sector;
      renderAll();
    };
  });

  byId('btnClear').onclick = ()=>{
    state.filter = { search:'', line:'Tutte', sector:'all', onlyLate:false, stacked: state.filter.stacked };
    byId('txtSearch').value=''; byId('selLinea').value='Tutte'; byId('chkLate').checked=false;
    qsa('#chipsSector .chip').forEach((c,i)=> c.classList.toggle('active', i===0));
    renderAll();
  };

  byId('btnZoomIn').onclick = ()=>{ state.chart.zoom=Math.min(2,state.chart.zoom+0.1); renderAll(); };
  byId('btnZoomOut').onclick = ()=>{ state.chart.zoom=Math.max(0.6,state.chart.zoom-0.1); renderAll(); };
  byId('chkStacked').onchange = e=>{ state.filter.stacked=e.target.checked; renderAll(); };

  byId('btnCollapseAll').onclick = ()=>{ applyFilters().forEach(a=>a.collapsed=true); save(); renderAll(); };
  byId('btnExpandAll').onclick = ()=>{ applyFilters().forEach(a=>a.collapsed=false); save(); renderAll(); };

  byId('btnNew').onclick = ()=>{
    // crea CH successiva
    const nums = state.areas.map(a=>parseInt(a.line.replace(/\D/g,''))||0);
    const next = Math.max(0,...nums)+1;
    state.areas.push(mkArea(`CH ${next}`,'rettifica'));
    save(); renderAll();
  };

  byId('btnExport').onclick = ()=>{
    const blob = new Blob([JSON.stringify(state.areas,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='skf5s-export.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  byId('btnImport').onclick = ()=>{
    const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
    inp.onchange = ()=> {
      const f = inp.files[0]; if(!f) return;
      const r=new FileReader(); r.onload=()=>{
        try{ state.areas=JSON.parse(r.result); save(); renderAll(); }
        catch{ alert('File non valido'); }
      }; r.readAsText(f);
    };
    inp.click();
  };
  byId('btnPrint').onclick = ()=> window.print();
}

/* ---------- Avvio ---------- */
load();
bindUI();
renderAll();
