/* ============== SKF 5S – App logic (v7.9.6) ============== */

const APP_VERSION = 'v7.9.6';
document.getElementById('appVersion').textContent = APP_VERSION;

// Chart può non essere disponibile (offline prima apertura / CDN bloccato)
const CHART_OK = typeof window.Chart !== 'undefined';
if (!CHART_OK) {
  // mostra fallback e continua: il resto dell’app funziona
  document.getElementById('chartFallback').style.display = 'block';
}

if (CHART_OK) {
  // plugin per etichette
  Chart.register(ChartDataLabels);
}

const COLORS = {
  s1: css('--s1'), s2: css('--s2'), s3: css('--s3'), s4: css('--s4'), s5: css('--s5'), text: css('--text')
};
function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

const LS_KEY = 'skf5s.v2';
let state = load() || seed();

function seed(){
  return { theme:'light', lines:[ mkArea('CH 2'), mkArea('CH 3') ] };
}
function mkArea(name){
  return { id:crypto.randomUUID(), name, sector:'rettifica', items:[
    mkItem('1-S Stato'), mkItem('Sicurezza'), mkItem('Qualità'), mkItem('Pulizia')
  ], collapsed:false };
}
function mkItem(title){ return { id:crypto.randomUUID(), title, points:0, responsible:'', due:'', note:'', s:guessS(title) }; }
function guessS(t){
  t=t.toLowerCase();
  if (t.includes('selez')||t.includes('stato')) return 1;
  if (t.includes('sistem')||t.includes('posto')) return 2;
  if (t.includes('puliz')||t.includes('splend')) return 3;
  if (t.includes('standard')||t.includes('regole')) return 4;
  if (t.includes('sosten')||t.includes('discipl')) return 5;
  return 1;
}
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function load(){ try{return JSON.parse(localStorage.getItem(LS_KEY))}catch{return null} }

const elSelLinea = document.getElementById('selLinea');
const elChkStacked = document.getElementById('chkStacked');
const elChkLate = document.getElementById('chkLate');
const elSearch = document.getElementById('txtSearch');
const elAreas = document.getElementById('areas');
const elBadgesRow = document.getElementById('badgesRow');

let chart;
renderAll();

function renderAll(){ renderFilters(); renderDashboard(); renderAreaCards(); }

function renderFilters(){
  elSelLinea.innerHTML = '<option value="all">Linea: Tutte</option>' +
    state.lines.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
  elBadgesRow.innerHTML='';
  ['Tutte',...state.lines.map(a=>a.name)].forEach((label,i)=>{
    const b=document.createElement('button');
    b.className='badge'+(i===0?' active':''); b.textContent=label; b.dataset.filter=i===0?'all':label;
    b.addEventListener('click',()=>{
      document.querySelectorAll('.badges-row .badge').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      elSelLinea.value = i===0?'all':(state.lines.find(x=>x.name===label)?.id||'all');
      renderDashboard(); renderAreaCards();
    });
    elBadgesRow.appendChild(b);
  });
}

function applyFilters(lines){
  const term = elSearch.value.trim().toLowerCase();
  const id = elSelLinea.value;
  let res=[...lines];
  if (id!=='all') res=res.filter(a=>a.id===id);
  if (term){
    res=res.filter(a=>a.items.some(i=> i.title.toLowerCase().includes(term) ||
      i.note.toLowerCase().includes(term) || i.responsible.toLowerCase().includes(term)));
  }
  if (elChkLate.checked){ res=res.filter(a=> areaStats(a).late>0); }
  const activeSector = document.querySelector('.filter-chips .chip.active')?.dataset?.sector || 'all';
  if (activeSector!=='all') res=res.filter(a=>a.sector===activeSector);
  return res;
}

function renderDashboard(){
  const lines = applyFilters(state.lines);
  document.getElementById('kpiLines').textContent = lines.length;
  const gs = globalStats(lines);
  document.getElementById('kpiAvg').textContent = gs.avg + '%';
  document.getElementById('kpiLate').textContent = gs.late;

  if (!CHART_OK){
    // senza Chart non provo a disegnare
    return;
  }

  const labels = lines.map(a=>a.name);
  const byS = [1,2,3,4,5].map(s=> lines.map(a=>areaStats(a).byS[s]));
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
  chart = new Chart(ctx,{
    type:'bar',
    data:{labels, datasets},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        datalabels:{
          color:'#fff', font:{weight:800, size:11},
          formatter:v=> v>0? v+'%':'',
          anchor:'end', align:'end', clamp:true, offset: stacked?2:-12, padding:2
        },
        tooltip:{callbacks:{title:i=>i[0].label, label:c=>`${c.dataset.label}: ${c.formattedValue}%`}}
      },
      scales:{
        x:{stacked:stacked, ticks:{color:COLORS.text, autoSkip:false, padding:10}},
        y:{stacked:stacked, beginAtZero:true, max:100, ticks:{color:COLORS.text, callback:v=>v+'%'}}
      },
      layout:{padding:{top: stacked?14:6}}
    }
  });
}

function renderAreaCards(){
  const lines = applyFilters(state.lines);
  elAreas.innerHTML='';
  lines.forEach(a=>{
    const st = areaStats(a);
    const card=document.createElement('div');
    card.className='area';
    card.innerHTML=`
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
          <button class="btn" data-act="toggle" data-id="${a.id}">${a.collapsed?'Espandi':'Comprimi'}</button>
          <button class="btn" data-act="del" data-id="${a.id}" style="background:#ff4d6d;color:#fff;border-color:#ff4d6d">Elimina</button>
        </div>
      </div>
      <div class="area__body" ${a.collapsed?'style="display:none"':''}>
        ${renderItems(a)}
        ${renderSBadges(a)}
      </div>`;
    elAreas.appendChild(card);
  });

  elAreas.querySelectorAll('.inpName').forEach(i=>i.addEventListener('change',e=>{
    const a=state.lines.find(x=>x.id===e.target.dataset.id); a.name=e.target.value; save(); renderAll();
  }));
  elAreas.querySelectorAll('.selSector').forEach(i=>i.addEventListener('change',e=>{
    const a=state.lines.find(x=>x.id===e.target.dataset.id); a.sector=e.target.value; save(); renderDashboard();
  }));
  elAreas.querySelectorAll('button[data-act]').forEach(b=>b.addEventListener('click',e=>{
    const id=e.currentTarget.dataset.id; const a=state.lines.find(x=>x.id===id); const act=e.currentTarget.dataset.act;
    if (act==='add') a.items.push(mkItem('Nuova voce'));
    if (act==='toggle') a.collapsed=!a.collapsed;
    if (act==='del'){ if(confirm('Eliminare la linea?')) state.lines=state.lines.filter(x=>x.id!==id); }
    save(); renderAll();
  }));

  elAreas.querySelectorAll('.dot').forEach(d=>d.addEventListener('click',e=>{
    const aId=e.currentTarget.dataset.aid, iId=e.currentTarget.dataset.iid, val=+e.currentTarget.dataset.v;
    const a=state.lines.find(x=>x.id===aId), it=a.items.find(x=>x.id===iId);
    it.points=val; save(); renderDashboard(); renderAreaCards();
  }));
  elAreas.querySelectorAll('.item input, .item textarea').forEach(el=>el.addEventListener('change',e=>{
    const wrap=e.target.closest('.item'); const aId=wrap.dataset.aid; const iId=wrap.dataset.iid;
    const a=state.lines.find(x=>x.id===aId), it=a.items.find(x=>x.id===iId);
    if (e.target.name==='responsible') it.responsible=e.target.value;
    if (e.target.name==='due') it.due=e.target.value;
    if (e.target.name==='note') it.note=e.target.value;
    save(); renderDashboard();
  }));
}

function renderItems(a){
  return a.items.map(it=>{
    const circle=v=>`<span class="dot ${it.points===v?'active':''}" data-aid="${a.id}" data-iid="${it.id}" data-v="${v}">${v}</span>`;
    return `
    <div class="item" data-aid="${a.id}" data-iid="${it.id}">
      <div class="item__row">
        <div class="item__title">${it.title}</div>
        <div class="points">${circle(0)} ${circle(1)} ${circle(3)} ${circle(5)}</div>
        <div class="item__meta">
          <input type="text" name="responsible" placeholder="Responsabile" value="${it.responsible||''}" />
          <input type="date" name="due" value="${it.due||''}" />
        </div>
        <div class="item__meta" style="width:100%">
          <input type="text" name="note" style="width:100%" placeholder="Note…" value="${it.note||''}" />
        </div>
      </div>
    </div>`;
  }).join('');
}
function renderSBadges(a){
  const st=areaStats(a); const mk=s=>`<span class="badge s${s} ${st.predom.s===s?'active':''}">${s}S <b>${st.byS[s]}%</b></span>`;
  return `<div class="pills">${mk(1)}${mk(2)}${mk(3)}${mk(4)}${mk(5)}</div>`;
}

function areaStats(area){
  const perS={1:[],2:[],3:[],4:[],5:[]}; for (const it of area.items) perS[it.s].push(it.points);
  const res={byS:{}, avg:0, predom:{s:1,val:0}, late:0}; let all=[];
  for (let s=1;s<=5;s++){ const arr=perS[s], sum=arr.reduce((a,b)=>a+b,0), max=(arr.length*5)||1; res.byS[s]=Math.round((sum/max)*100); all=all.concat(arr); }
  const sumAll=all.reduce((a,b)=>a+b,0), maxAll=(area.items.length*5)||1; res.avg=Math.round((sumAll/maxAll)*100);
  let best=0,bS=1; for(let s=1;s<=5;s++){ if(res.byS[s]>best){best=res.byS[s]; bS=s;} } res.predom={s:bS,val:best};
  const now=new Date().toISOString().slice(0,10); res.late=area.items.filter(i=>i.due && i.due<now && i.points<5).length;
  return res;
}
function globalStats(lines){ if(!lines.length) return {avg:0,late:0}; let sum=0,late=0; for(const a of lines){ const s=areaStats(a); sum+=s.avg; late+=s.late; } return {avg:Math.round(sum/lines.length), late}; }

// eventi globali
document.getElementById('btnNew').addEventListener('click',()=>{ const n=nextName(); state.lines.push(mkArea(n)); save(); renderAll(); });
function nextName(){ let i=2; while(state.lines.some(a=>a.name==='CH '+i)) i++; return 'CH '+i; }
document.getElementById('btnExport').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state)],{type:'application/json'}); const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='SKF-5S-data.json'; a.click();
});
document.getElementById('btnImport').addEventListener('click',()=>{
  const i=document.createElement('input'); i.type='file'; i.accept='application/json';
  i.onchange=()=>{ const f=i.files[0]; if(!f) return; const r=new FileReader(); r.onload=e=>{ state=JSON.parse(e.target.result); save(); renderAll(); }; r.readAsText(f); };
  i.click();
});
document.getElementById('btnPrint').addEventListener('click',()=>window.print());
document.getElementById('btnTheme').addEventListener('click',()=>{ document.documentElement.classList.toggle('force-dark'); renderDashboard(); });
document.getElementById('btnClear').addEventListener('click',()=>{ elSearch.value=''; elSelLinea.value='all'; elChkLate.checked=false; document.querySelectorAll('.filter-chips .chip').forEach(c=>c.classList.toggle('active', c.dataset.sector==='all')); renderAll(); });
document.querySelectorAll('.filter-chips .chip').forEach(c=>c.addEventListener('click',()=>{ document.querySelectorAll('.filter-chips .chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); renderDashboard(); renderAreaCards(); }));
elSearch.addEventListener('input',()=>{ renderDashboard(); renderAreaCards(); });
elSelLinea.addEventListener('change',()=>{ renderDashboard(); renderAreaCards(); });
elChkLate.addEventListener('change',()=>{ renderDashboard(); renderAreaCards(); });
elChkStacked.addEventListener('change',()=>{ renderDashboard(); });
document.getElementById('btnZoomIn').addEventListener('click',()=>zoom(1.1));
document.getElementById('btnZoomOut').addEventListener('click',()=>zoom(0.9));
function zoom(m){ const c=document.getElementById('chartAreas'); const h=c.height||220; c.height=Math.max(160, Math.min(460, h*m)); chart?.resize(); }
document.getElementById('btnCollapseAll').addEventListener('click',()=>{ state.lines.forEach(a=>a.collapsed=true); save(); renderAreaCards(); });
document.getElementById('btnExpandAll').addEventListener('click',()=>{ state.lines.forEach(a=>a.collapsed=false); save(); renderAreaCards(); });
