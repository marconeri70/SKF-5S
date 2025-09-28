/* SKF 5S Supervisor – minimal working app
   - Import multipli (unisce i dati)
   - Salva in localStorage ("sup-data")
   - Index: mostra grafici per ogni CH + nav
   - Checklist: schede raggruppate per CH (sola lettura), pulsante Blocca/Modifica
   - Note: raccolta per CH e S ordinate per data
*/
const KEY="sup-data-v2";
function getData(){ try{ return JSON.parse(localStorage.getItem(KEY))||{records:[]}; }catch(e){ return {records:[]}; } }
function saveData(db){ localStorage.setItem(KEY, JSON.stringify(db)); }

// COMMON helpers
const S_COLORS={s1:"#7c3aed",s2:"#ef4444",s3:"#f59e0b",s4:"#10b981",s5:"#2563eb"};
function fmtPct(n){ return `${Math.round(n)}%`; }
function byDate(a,b){ return (a.date||"").localeCompare(b.date||""); }

// IMPORT
function pickAndImport(inputId, after){
  const el=document.getElementById(inputId);
  el.onchange=async (ev)=>{
    const files=[...ev.target.files];
    if(!files.length) return;
    const db=getData();
    for(const f of files){
      const txt=await f.text();
      try{
        const obj=JSON.parse(txt);
        // support: single object OR array
        const arr=Array.isArray(obj)?obj:[obj];
        for(const r of arr){
          // expected: {area,channel,date,points:{s1..s5},notes?,dates?,detail?}
          if(!r || !r.channel || !r.points) continue;
          db.records.push({
            area:r.area||"", channel:r.channel, date:r.date||new Date().toISOString(),
            points:{
              s1: Number(r.points.s1||0), s2:Number(r.points.s2||0), s3:Number(r.points.s3||0),
              s4:Number(r.points.s4||0), s5:Number(r.points.s5||0)
            },
            notes:r.notes||[], dates:r.dates||[], detail:r.detail||{}
          });
        }
      }catch(e){ console.warn("JSON err",e); }
    }
    saveData(db);
    after && after(db);
    el.value="";
  };
  el.click();
}

// INDEX PAGE
function renderIndex(){
  const chartsWrap=document.getElementById("charts");
  if(!chartsWrap) return;
  const db=getData();
  const channels=[...new Set(db.records.map(r=>`${r.channel}|||${r.area||""}`))];
  // filter select
  const sel=document.getElementById("chFilter");
  sel.innerHTML='<option value="">Tutti i CH</option>'+channels.map(tag=>{
    const [ch,ar]=tag.split("|||"); return `<option value="${ch}">${ch}${ar?` — ${ar}`:""}</option>`;
  }).join("");
  sel.onchange=()=>renderCharts(sel.value);
  document.getElementById("btnImport").onclick=()=> pickAndImport("fileInput", ()=>renderCharts(sel.value));
  document.getElementById("btnExport").onclick=()=>{
    const blob=new Blob([JSON.stringify(getData(),null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="Supervisor-Archive.json"; a.click();
  };
  renderCharts("");
}
function renderCharts(filterCh){
  const chartsWrap=document.getElementById("charts");
  const nav=document.getElementById("channelsNav");
  const db=getData();
  const byCh={};
  for(const r of db.records){
    if(filterCh && r.channel!==filterCh) continue;
    (byCh[r.channel]=byCh[r.channel]||{area:r.area, s1:[],s2:[],s3:[],s4:[],s5:[], dates:[]});
    byCh[r.channel].s1.push(r.points.s1); byCh[r.channel].s2.push(r.points.s2);
    byCh[r.channel].s3.push(r.points.s3); byCh[r.channel].s4.push(r.points.s4);
    byCh[r.channel].s5.push(r.points.s5); byCh[r.channel].dates.push(r.date);
  }
  chartsWrap.innerHTML="";
  nav.innerHTML="";
  const CHS=Object.keys(byCh);
  if(!CHS.length){ chartsWrap.innerHTML='<p class="muted">Nessun dato importato.</p>'; return; }
  // nav
  CHS.forEach(ch=>{
    const b=document.createElement("button");
    b.className="ch-btn"; b.textContent=ch; b.onclick=()=>{ document.getElementById("chFilter").value=ch; renderCharts(ch); window.scrollTo({top:0,behavior:"smooth"}); };
    nav.appendChild(b);
  });
  // cards
  CHS.forEach(ch=>{
    const card=document.createElement("div"); card.className="chart-card";
    card.innerHTML=`<h3><span>${ch}${byCh[ch].area?` — ${byCh[ch].area}`:""}</span>
      <span><button class="icon-btn" onclick="window.location='checklist.html'">Apri in checklist</button></span></h3>
      <canvas height="160"></canvas>`;
    chartsWrap.appendChild(card);
    const ctx=card.querySelector("canvas").getContext("2d");
    const avg=(arr)=> arr.length? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
    const data=[avg(byCh[ch].s1),avg(byCh[ch].s2),avg(byCh[ch].s3),avg(byCh[ch].s4),avg(byCh[ch].s5)];
    new Chart(ctx,{type:"bar",data:{labels:["1S","2S","3S","4S","5S"],
      datasets:[{data, backgroundColor:[S_COLORS.s1,S_COLORS.s2,S_COLORS.s3,S_COLORS.s4,S_COLORS.s5]}]
    }, options:{responsive:true,plugins:{legend:{display:false},tooltip:{enabled:true}}, scales:{y:{suggestedMax:100}}});
  });
}

// CHECKLIST PAGE (read-only view grouped by CH; import multipli)
function renderChecklist(){
  const wrap=document.getElementById("channelsWrap");
  if(!wrap) return;
  const db=getData();
  document.getElementById("btnImport2").onclick=()=>pickAndImport("fileInput2",()=>renderChecklist());
  const lockBtn=document.getElementById("btnLock");
  let locked=true; const setLock=()=>{ lockBtn.textContent=locked?"Sblocca":"Blocca"; wrap.querySelectorAll("input,textarea,button").forEach(el=>{ if(el.dataset.free!=="1") el.disabled=locked; }); };
  lockBtn.onclick=()=>{ locked=!locked; setLock(); };
  const byCh={};
  db.records.forEach(r=>{ (byCh[r.channel]=byCh[r.channel]||[]).push(r); });
  wrap.innerHTML="";
  Object.entries(byCh).forEach(([ch,arr])=>{
    arr.sort(byDate);
    const card=document.createElement("div"); card.className="ch-card";
    card.innerHTML=`<div class="ch-head"><div class="ch-title">${(arr[0].area||"").toUpperCase()} — ${ch}</div>
      <div class="ch-ctrls"><button class="icon-btn" data-free="1">Comprimi / Espandi</button></div></div>
      <div class="sheets"></div>`;
    const sheets=card.querySelector(".sheets");
    card.querySelector(".icon-btn").onclick=()=> card.classList.toggle("collapsed");
    arr.forEach(r=>{
      const sh=document.createElement("div"); sh.className="sheet";
      const tot= (r.points.s1+r.points.s2+r.points.s3+r.points.s4+r.points.s5)/5;
      sh.innerHTML=`<div class="sheet-head">
          <span class="s-color" style="background:#ddd"></span>
          <h4 class="s-title" style="margin:0">${r.date.split("T")[0]}</h4>
          <span class="s-value">Voto medio: ${fmtPct(tot)}</span>
        </div>
        <div class="kpis">
          <span class="chip s1">1S ${fmtPct(r.points.s1)}</span>
          <span class="chip s2">2S ${fmtPct(r.points.s2)}</span>
          <span class="chip s3">3S ${fmtPct(r.points.s3)}</span>
          <span class="chip s4">4S ${fmtPct(r.points.s4)}</span>
          <span class="chip s5">5S ${fmtPct(r.points.s5)}</span>
        </div>
        ${r.notes && r.notes.length? `<details class="mt"><summary>Note (${r.notes.length})</summary><ul>${r.notes.map(n=>`<li>${n}</li>`).join("")}</ul></details>`:""}
      `;
      sheets.appendChild(sh);
    });
    wrap.appendChild(card);
  });
  setLock();
}

// NOTES PAGE
function renderNotes(){
  const wrap=document.getElementById("notesWrap");
  if(!wrap) return;
  const db=getData();
  const byCh={};
  db.records.forEach(r=>{
    const list=(r.detail && r.detail.items) ? r.detail.items : []; // compat
    const notes=(r.notes||[]).map(t=>({t, s:"", date:r.date})).concat(
      list.filter(x=>x && x.note).map(x=>({t:x.note, s:x.s||"", date:x.date||r.date}))
    );
    if(!notes.length) return;
    (byCh[r.channel]=byCh[r.channel]||[]).push(...notes);
  });
  wrap.innerHTML="";
  Object.entries(byCh).forEach(([ch,arr])=>{
    arr.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
    const card=document.createElement("div"); card.className="ch-card";
    card.innerHTML=`<div class="ch-head"><div class="ch-title">${ch}</div></div>`;
    const ul=document.createElement("ul"); ul.style.margin="0"; ul.style.paddingLeft="18px";
    arr.forEach(n=>{
      const li=document.createElement("li");
      li.innerHTML = `<strong>${(n.s||"")}</strong> — <em>${(n.date||"").split("T")[0]}</em>: ${n.t}`;
      ul.appendChild(li);
    });
    card.appendChild(ul);
    wrap.appendChild(card);
  });
}

// ROUTER
document.addEventListener("DOMContentLoaded",()=>{
  renderIndex(); renderChecklist(); renderNotes();
  const b1=document.getElementById("btnImport"); if(b1) b1.onclick=()=> pickAndImport("fileInput",()=>renderIndex());
});
