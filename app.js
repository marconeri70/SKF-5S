
/* SKF 5S – v7.3 classic */
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
const storeKey = 'skf.fiveS.v7.3.classic';

const POINTS=[0,1,3,5];
const VOC_1S=["Zona pedonale pavimento","Zona di lavoro (pavimento, macchina)","Materiali","Informazioni","Processo di etichettatura"];
const VOC_2S=["Sicurezza","Qualità","Posizione Pre-Fissate","Documenti","Concetti"];
const VOC_3S=["Pulizia","Misure preventive","La pulizia è di routine e esiste un piano per un risultato duraturo"];
const VOC_4S=["Aree di  passaggio","Area di lavoro","Materiali","Informazione","Visual Management"];
const VOC_5S=["Piano per sostenere il risultato","Piano per risultati duraturi","Coinvolgimento dei membri del team"];

function makeArea(line, sector){
  const map=l=>l.map(t=>({t, p:0, note:"", resp:"", due:""}));
  return { line, sector, S:{ "1S":map(VOC_1S),"2S":map(VOC_2S),"3S":map(VOC_3S),"4S":map(VOC_4S),"5S":map(VOC_5S) } };
}

let state = load();
if(!state.areas || !state.areas.length){ state={areas:[makeArea("L2","Rettifica")]}; save(); }
state.areas = state.areas.map(a=>({ line:a.line||"Lx", sector:(a.sector==="Montaggio"?"Montaggio":"Rettifica"), S:a.S||{} }));
for(const a of state.areas){
  for(const s of ["1S","2S","3S","4S","5S"]){
    if(!Array.isArray(a.S[s])){ const src=s==="1S"?VOC_1S:s==="2S"?VOC_2S:s==="3S"?VOC_3S:s==="4S"?VOC_4S:VOC_5S; a.S[s]=src.map(t=>({t, p:0, note:"", resp:"", due:""})); }
    else{ a.S[s]=a.S[s].map(it=>({t:it.t||"", p:+it.p||0, note:it.note||"", resp:it.resp||"", due:it.due||""})); }
  }
}
save();

let ui={ q:"", line:"ALL", sector:"ALL", onlyLate:false };

render();
updateDashboard();

function load(){ try{const raw=localStorage.getItem(storeKey);return raw?JSON.parse(raw):{areas:[]};}catch(e){return{areas:[]};} }
function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }

function scoreList(list){ if(!list||!list.length) return 0; const s=list.reduce((a,it)=>a+(+it.p||0),0); return s/(5*list.length); }
function computeScores(area){
  const byS={}; let sum=0,max=0;
  for(const s of ["1S","2S","3S","4S","5S"]){ const l=area.S[s]||[]; byS[s]=scoreList(l); sum+=l.reduce((a,it)=>a+(+it.p||0),0); max+=5*l.length; }
  return { areaScore:max?(sum/max):0, byS };
}
function overallStats(arr){
  const a=arr||state.areas; let s=0,m=0,late=0;
  a.forEach(A=>{ for(const x of ["1S","2S","3S","4S","5S"]){ (A.S[x]||[]).forEach(it=>{ s+=(+it.p||0); m+=5; if(isOverdue(it.due)) late++; });}});
  return { score:m?(s/m):0, late };
}
function fmtPct(x){ return Math.round(x*100)+'%'; }
function isOverdue(iso){ if(!iso) return false; return new Date(iso+'T23:59:59') < new Date(); }

function matchFilters(a){ if(ui.sector!=='ALL' && a.sector!==ui.sector) return false; if(ui.line!=='ALL' && (a.line||'').trim()!==ui.line) return false; return true; }
function filteredAreas(){
  return state.areas.filter(a=>{
    if(!matchFilters(a)) return false;
    if(ui.q.trim()==='' && !ui.onlyLate) return true;
    const q=ui.q.trim().toLowerCase();
    for(const s of ["1S","2S","3S","4S","5S"]){
      for(const it of (a.S[s]||[])){
        if(ui.onlyLate && !isOverdue(it.due)) continue;
        const bag = `${it.t||''} ${it.note||''} ${it.resp||''}`.toLowerCase();
        if(bag.includes(q)) return true;
      }
    }
    return false;
  });
}
function refreshLineOptions(){
  const lines = Array.from(new Set(state.areas.map(a=>(a.line||'').trim()).filter(Boolean))).sort();
  const opts = ['<option value="ALL">Linea: Tutte</option>', ...lines.map(l=>`<option value="${l}">${l}</option>`)].join('');
  elLineFilter.innerHTML = opts; if(!lines.includes(ui.line)) ui.line='ALL'; elLineFilter.value = ui.line;
}

function render(){
  refreshLineOptions();
  const list = filteredAreas();
  elAreas.innerHTML='';
  list.forEach((area,idx)=> elAreas.appendChild(renderArea(area, state.areas.indexOf(area))));
  updateDashboard(list);
  drawAreasChart();
}
function renderArea(area, idx){
  const node=tplArea.content.firstElementChild.cloneNode(true);
  const lineEl=node.querySelector('.area-line');
  const scoreArea=node.querySelector('.score-val');
  const btnSecRet=node.querySelector('.sec-ret');
  const btnSecMon=node.querySelector('.sec-mont');
  const pills={"1S":node.querySelector('.score-1S'),"2S":node.querySelector('.score-2S'),"3S":node.querySelector('.score-3S'),"4S":node.querySelector('.score-4S'),"5S":node.querySelector('.score-5S')};

  lineEl.value=area.line||"";
  btnSecRet.classList.toggle('active', area.sector==="Rettifica");
  btnSecMon.classList.toggle('active', area.sector==="Montaggio");

  lineEl.addEventListener('input', ()=>{ state.areas[idx].line = lineEl.value.trim(); save(); render(); });
  btnSecRet.addEventListener('click', ()=>{ state.areas[idx].sector="Rettifica"; save(); render(); });
  btnSecMon.addEventListener('click', ()=>{ state.areas[idx].sector="Montaggio"; save(); render(); });

  node.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      node.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      node.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.dataset.s===tab.dataset.s));
    });
  });

  node.querySelectorAll('.panel').forEach(panel=>{
    const s=panel.dataset.s; panel.innerHTML='';
    (area.S[s]||[]).forEach((it,i)=> panel.appendChild(renderItem(idx,s,i,it)));
  });

  node.querySelector('.add-item').addEventListener('click', ()=>{
    const s=node.querySelector('.tab.active').dataset.s;
    state.areas[idx].S[s].push({t:"", p:0, note:"", resp:"", due:""}); save(); render();
  });
  node.querySelector('.collapse').addEventListener('click', (e)=>{
    node.classList.toggle('collapsed'); e.target.textContent=node.classList.contains('collapsed')?"Espandi":"Comprimi";
  });
  node.querySelector('.delete-area').addEventListener('click', ()=>{
    if(confirm('Eliminare la linea?')){ state.areas.splice(idx,1); save(); render(); }
  });

  const { areaScore, byS }=computeScores(area);
  scoreArea.textContent = fmtPct(areaScore);
  Object.entries(byS).forEach(([k,v])=> pills[k].textContent = fmtPct(v));

  return node;
}
function renderItem(aIdx,sKey,iIdx,item){
  const node=tplItem.content.firstElementChild.cloneNode(true);
  node.querySelector('.txt').value=item.t||"";
  node.querySelector('.points').value=String(POINTS.includes(+item.p)?item.p:0);
  node.querySelector('.resp').value=item.resp||"";
  node.querySelector('.due').value=item.due||"";
  node.querySelector('.note').value=item.note||"";
  const setLate=()=> node.classList.toggle('late', isOverdue(node.querySelector('.due').value)); setLate();

  node.querySelector('.txt').addEventListener('input',(e)=>{ state.areas[aIdx].S[sKey][iIdx].t=e.target.value; save(); });
  node.querySelector('.points').addEventListener('change',(e)=>{ state.areas[aIdx].S[sKey][iIdx].p=+e.target.value; save(); render(); });
  node.querySelector('.resp').addEventListener('input',(e)=>{ state.areas[aIdx].S[sKey][iIdx].resp=e.target.value; save(); });
  node.querySelector('.due').addEventListener('change',(e)=>{ state.areas[aIdx].S[sKey][iIdx].due=e.target.value; save(); setLate(); updateDashboard(); });
  node.querySelector('.note').addEventListener('input',(e)=>{ state.areas[aIdx].S[sKey][iIdx].note=e.target.value; save(); });
  node.querySelector('.del').addEventListener('click', ()=>{ state.areas[aIdx].S[sKey].splice(iIdx,1); save(); render(); });

  return node;
}

function updateDashboard(areas){
  const arr=areas||filteredAreas();
  elKpiAreas.textContent=arr.length;
  const {score,late}=overallStats(arr);
  elKpiScore.textContent=fmtPct(score);
  elKpiLate.textContent=late;
}

function drawAreasChart(){
  const c=document.getElementById('chartAreas'); if(!c) return;
  const ctx=c.getContext('2d');
  const Hpx=220, W=c.width=c.clientWidth*devicePixelRatio, H=c.height=Hpx*devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); ctx.clearRect(0,0,W,H);

  const areas=filteredAreas();
  const byLine={}; areas.forEach(a=>{ const k=(a.line||'').trim()||'—'; (byLine[k] ||= []).push(a); });
  const groups=Object.entries(byLine).map(([line,list])=>{
    let t={ "1S":{sum:0,max:0},"2S":{sum:0,max:0},"3S":{sum:0,max:0},"4S":{sum:0,max:0},"5S":{sum:0,max:0} };
    list.forEach(a=>{ for(const s of ["1S","2S","3S","4S","5S"]){ (a.S[s]||[]).forEach(it=>{ t[s].sum+=(+it.p||0); t[s].max+=5; }); } });
    const byS={}; for(const s in t){ byS[s]=t[s].max? t[s].sum/t[s].max : 0; }
    const sumAll=Object.values(t).reduce((x,v)=>x+v.sum,0), maxAll=Object.values(t).reduce((x,v)=>x+v.max,0);
    return { line, vals:{ "TOT":(maxAll?sumAll/maxAll:0), ...byS } };
  }).sort((a,b)=> a.line.localeCompare(b.line));

  const padL=60,padR=16,padT=18,padB=40;
  const plotW=(W/devicePixelRatio)-padL-padR, plotH=(H/devicePixelRatio)-padT-padB;
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+plotH); ctx.lineTo(padL+plotW,padT+plotH); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='12px system-ui';
  for(let i=0;i<=4;i++){ const yv=i*25,y=padT+plotH-(yv/100)*plotH; ctx.fillText(yv+'%',8,y+4); ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke(); }
  if(!groups.length) return;
  const gv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COLORS={ "TOT":'#9bb0d6',"1S":gv('--c1')||'#7a56c6',"2S":gv('--c2')||'#e44f37',"3S":gv('--c3')||'#f3a11a',"4S":gv('--c4')||'#35b468',"5S":gv('--c5')||'#4b88ff' };
  const MET=["TOT","1S","2S","3S","4S","5S"]; const inner=4,bw=14,gw=MET.length*bw+(MET.length-1)*inner,gap=max(18,gw*.9);
  function max(a,b){return a>b?a:b}
  const total=groups.length*gw+(groups.length-1)*gap, start=padL+max(8,(plotW-total)/2);
  let x=start;
  groups.forEach(g=>{
    let bx=x;
    MET.forEach(m=>{ const v=g.vals[m]||0,h=v*plotH,y=padT+plotH-h; ctx.fillStyle=COLORS[m]; ctx.fillRect(bx,y,bw,h); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(Math.round(v*100)+'%', bx+bw/2, (h>16? y-4 : padT+plotH-2)); bx+=bw+inner; });
    ctx.save(); ctx.translate(x+gw/2, padT+plotH+18); ctx.rotate(-Math.PI/12); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(g.line,0,0); ctx.restore();
    x+=gw+gap;
  });
}

document.getElementById('btnNewArea').addEventListener('click', ()=>{
  const line=(prompt("Linea nuova? (es. L3)","L3")||"Lx").trim();
  const sector=(prompt("Settore? (Rettifica/Montaggio)","Rettifica")||"Rettifica").trim();
  state.areas.push(makeArea(line, sector==='Montaggio'?'Montaggio':'Rettifica')); save(); render();
});
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`SKF_5S_${new Date().toISOString().slice(0,10)}.json`}); document.body.appendChild(a); a.click(); a.remove();
});
document.getElementById('fileImport').addEventListener('change', async (e)=>{
  const f=e.target.files[0]; if(!f) return; try{ state=JSON.parse(await f.text()); save(); render(); }catch(err){ alert('JSON non valido'); }
});
document.getElementById('btnPrint').addEventListener('click', ()=>window.print());

elQ.addEventListener('input', ()=>{ ui.q=elQ.value; render(); });
elLineFilter.addEventListener('change', ()=>{ ui.line=elLineFilter.value; render(); });
btnFgr.addEventListener('click', ()=>{ ui.sector='Rettifica'; btnFgr.classList.add('active'); btnAsm.classList.remove('active'); btnAll.classList.remove('active'); render(); });
btnAsm.addEventListener('click', ()=>{ ui.sector='Montaggio'; btnAsm.classList.add('active'); btnFgr.classList.remove('active'); btnAll.classList.remove('active'); render(); });
btnAll.addEventListener('click', ()=>{ ui.sector='ALL'; btnAll.classList.add('active'); btnFgr.classList.remove('active'); btnAsm.classList.remove('active'); render(); });
elOnlyLate.addEventListener('change', ()=>{ ui.onlyLate=elOnlyLate.checked; render(); });
elBtnClear.addEventListener('click', ()=>{ ui={q:'',line:'ALL',sector:'ALL',onlyLate:false}; elQ.value=''; elLineFilter.value='ALL'; btnAll.click(); elOnlyLate.checked=false; render(); });
