const tplArea = document.getElementById('tplArea');
const tplItem = document.getElementById('tplItem');
const elAreas = document.getElementById('areas');
const storeKey = 'skf.5s.v3';

const WEIGHTS = { OK:1, MIN:1, MAJ:2, CRIT:3 };
let state = load();

// --- STORAGE ---
function load(){ try{ return JSON.parse(localStorage.getItem(storeKey))||{areas:[]}; }catch{ return {areas:[]}; } }
function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }

// --- RENDER ---
function render(){
  elAreas.innerHTML = '';
  state.areas.forEach((a,i)=> elAreas.appendChild(renderArea(a,i)));
  updateDashboard();
}
function renderArea(area, idx){
  const node = tplArea.content.firstElementChild.cloneNode(true);
  const name = node.querySelector('.area-name');
  name.value = area.name||"";
  name.oninput = ()=>{ state.areas[idx].name = name.value; save(); };

  // tabs
  node.querySelectorAll('.tab').forEach(tab=>{
    tab.onclick=()=>{
      node.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      node.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      node.querySelector(`.panel[data-s="${tab.dataset.s}"]`).classList.add('active');
    };
  });

  // panels
  node.querySelectorAll('.panel').forEach(p=>{
    const s = p.dataset.s;
    (area.S?.[s] ||= []).forEach((item,ii)=> p.appendChild(renderItem(idx,s,ii,item)));
  });

  node.querySelector('.add-item').onclick=()=>{
    const s = node.querySelector('.tab.active').dataset.s;
    state.areas[idx].S[s].push({t:"",sev:"OK",done:false,resp:"",due:"",note:""});
    save(); render();
  };
  node.querySelector('.delete-area').onclick=()=>{ if(confirm("Eliminare area?")){ state.areas.splice(idx,1); save(); render(); } };

  const score = computeScore(area).areaScore;
  node.querySelector('.score-val').textContent = fmtPct(score);
  if(score>=0.9) node.style.borderLeft="6px solid var(--ok)";
  else if(score>=0.8) node.style.borderLeft="6px solid var(--min)";
  else node.style.borderLeft="6px solid var(--crit)";

  return node;
}
function renderItem(aIdx,sKey,iIdx,item){
  const node = tplItem.content.firstElementChild.cloneNode(true);
  const chk=node.querySelector('.chk'), txt=node.querySelector('.txt'),
        resp=node.querySelector('.resp'), due=node.querySelector('.due'),
        note=node.querySelector('.note'), sev=node.querySelector('.sev-badge');
  node.dataset.sev=item.sev; sev.textContent=item.sev;
  chk.checked=item.done; txt.value=item.t; resp.value=item.resp; due.value=item.due; note.value=item.note;

  chk.onchange=()=>{ state.areas[aIdx].S[sKey][iIdx].done=chk.checked; save(); render(); };
  txt.oninput=()=>{ state.areas[aIdx].S[sKey][iIdx].t=txt.value; save(); };
  resp.oninput=()=>{ state.areas[aIdx].S[sKey][iIdx].resp=resp.value; save(); };
  due.onchange=()=>{ state.areas[aIdx].S[sKey][iIdx].due=due.value; save(); render(); };
  note.oninput=()=>{ state.areas[aIdx].S[sKey][iIdx].note=note.value; save(); };
  node.querySelector('.del').onclick=()=>{ state.areas[aIdx].S[sKey].splice(iIdx,1); save(); render(); };

  // late check
  if(item.due && !item.done && new Date(item.due)<new Date()) node.classList.add("late");
  return node;
}

// --- SCORE ---
function computeScore(area){
  let done=0,tot=0;
  for(const s of ["1S","2S","3S","4S","5S"]){
    (area.S?.[s]||[]).forEach(it=>{
      const w=WEIGHTS[it.sev]||1; tot+=w; if(it.done) done+=w;
    });
  }
  return {areaScore: tot?done/tot:0};
}

// --- DASHBOARD ---
function updateDashboard(){
  document.getElementById('kpiAreas').textContent=state.areas.length;
  let d=0,t=0,late=0;
  state.areas.forEach(a=>{
    for(const s of ["1S","2S","3S","4S","5S"])
      (a.S?.[s]||[]).forEach(it=>{
        const w=WEIGHTS[it.sev]; t+=w; if(it.done) d+=w;
        if(it.due && !it.done && new Date(it.due)<new Date()) late++;
      });
  });
  const score=t?d/t:0;
  document.getElementById('kpiScore').textContent=fmtPct(score);
  document.getElementById('kpiLate').textContent=late;

  // chart
  const ctx=document.getElementById('scoreChart');
  if(window.myChart) window.myChart.destroy();
  window.myChart=new Chart(ctx,{type:'doughnut',data:{
    labels:["Completato","Da fare"],
    datasets:[{data:[d,t-d],backgroundColor:["#3ecf8e","#ddd"]}]
  },options:{plugins:{legend:{display:false}},cutout:"70%"}});
}

function fmtPct(x){ return Math.round(x*100)+"%"; }

// --- BUTTONS ---
document.getElementById('btnNewArea').onclick=()=>{
  state.areas.push({name:"Nuova area",S:{"1S":[],"2S":[],"3S":[],"4S":[],"5S":[]}});
  save(); render();
};
document.getElementById('btnExport').onclick=()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download="SKF5S.json"; a.click();
};
document.getElementById('fileImport').onchange=async e=>{
  const f=e.target.files[0]; if(!f) return;
  const data=JSON.parse(await f.text()); state=data; save(); render();
};
document.getElementById('btnPrint').onclick=()=>window.print();

// --- INIT ---
render();