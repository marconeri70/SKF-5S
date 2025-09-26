/** ========= SUPERVISORE ========= */
const CONFIG = { DEFAULT_PIN:"6170" };
const COLORS = { s1:"#7c3aed", s2:"#ef4444", s3:"#f59e0b", s4:"#10b981", s5:"#2563eb" };

/** Testi compatti “i” */
const INFO_TEXT = {
  s1:"(1) Area pedonale libera da ostacoli. (2) Nessun materiale non identificato a pavimento. (3) Solo materiali/strumenti necessari: il resto è rimosso. (4) Solo materiale necessario per il lavoro in corso. (5) Documenti/visual aggiornati e in buono stato. (6) Team e processo etichetta rossa definiti. (7) Lavagna 5S aggiornata (piano/foto/audit). (8) Evidenze sostenibilità 1S. (9) 5S/1S compresi; responsabilità definite. (10) Tutti partecipano.",
  s2:"(1) Area/team definiti; niente cose inutili. (2) Sicurezza segnalata e accessibile. (3) Emergenze visibili/libere. (4) Stazioni qualità organizzate. (5) SWC seguito. (6) Posizioni e min/max per utenze/strumenti/pulizia. (7) Posizioni chiare per contenitori/rifiuti. (8) WIP/accettati/rifiutati/quarantena identificati. (9) Materie prime/componenti con posizioni designate. (10) Layout corridoi/DPI. (11) Documenti al punto d’uso. (12) Miglioramenti one-touch/poka-yoke/ergonomia. (13) Evidenze sostenibilità 2S. (14) 5S/2S compresi; responsabilità definite.",
  s3:"(1) Niente cose inutili. (2) Miglioramenti 2S mantenuti. (3) Verifiche regolari e azioni. (4) 1S/2S compresi. (5) Pavimenti/pareti puliti. (6) Segnali puliti e leggibili. (7) Documenti protetti. (8) Luci/ventilazione ok. (9) Fonti sporco note. (10) Piano per eliminarle. (11) Azioni eseguite. (12) Prevenzione pulizia. (13) Riciclo attivo. (14) Demarcazioni permanenti. (15) Evidenze sostenibilità 3S.",
  s4:"(1) Visual mgmt/Min-Max a vista. (2) Colori standard per lubrificazioni/tubi/valvole. (3) Standard 5S consolidati e aggiornati. (4) Istruzioni integrate nella gestione quotidiana.",
  s5:"(1) Tutti formati e coinvolti. (2) 5S come abitudine. (3) Layered audit programmati. (4) Foto prima/dopo mantenute. (5) Obiettivi 5S in evidenza."
};

/** Storage */
const K = (k)=>`skf5s:supervisor:${k}`;
const Jget=(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
const Jset=(k,v)=> localStorage.setItem(k, JSON.stringify(v));

/** SW */
if ("serviceWorker" in navigator){ addEventListener("load", ()=> navigator.serviceWorker.register("sw.js")); }

/** Stato */
let state = Jget(K("state"), { pin:Jget("skf5s:pin", CONFIG.DEFAULT_PIN), archive:{} });
function save(){ Jset(K("state"), state); }
function ensureCH(ch){
  if(!state.archive[ch]){
    state.archive[ch] = {
      points:{s1:0,s2:0,s3:0,s4:0,s5:0},
      notes:{s1:"",s2:"",s3:"",s4:"",s5:""},
      dates:{s1:null,s2:null,s3:null,s4:null,s5:null},
      detail:{s1:{},s2:{},s3:{},s4:{},s5:{}}
    };
  }
  return state.archive[ch];
}

/** Utils */
const parsePoints = (txt)=>{
  const out=[]; const re=/\((\d+)\)\s*([^]+?)(?=\s*\(\d+\)\s*|$)/g; let m;
  while((m=re.exec(txt))) out.push(m[2].trim());
  return out;
};
const squares = (score)=> [0,1,3,5].map(v=> v===score?`🟦${v}`:`⬜${v}`).join(" ");
function nearestScore(mean){ const c=[0,1,3,5]; return c.reduce((a,b)=> Math.abs(b-mean)<Math.abs(a-mean)?b:a,0); }
function isLate(ch,k){
  const d = ensureCH(ch).dates[k];
  if(!d) return false;
  const t=new Date(); t.setHours(0,0,0,0);
  const c=new Date(d); c.setHours(0,0,0,0);
  return c<t;
}

/** PIN dialog */
function openPinDialog(){
  const dlg=document.getElementById("pinDialog"); if(!dlg) return;
  const pin=document.getElementById("pinInput");
  const np1=document.getElementById("newPin1"); const np2=document.getElementById("newPin2");
  const ok=document.getElementById("pinConfirmBtn"); const cancel=document.getElementById("pinCancel");
  pin.value=""; np1.value=""; np2.value=""; dlg.showModal();

  ok.onclick=()=>{
    if(pin.value!==String(state.pin)){ alert("PIN errato"); return; }
    if(np1.value||np2.value){
      if(np1.value!==np2.value){ alert("I due PIN non coincidono"); return; }
      if(!/^\d{3,8}$/.test(np1.value)){ alert("PIN non valido"); return; }
      state.pin=np1.value; Jset("skf5s:pin",state.pin);
    }
    save(); dlg.close();
  };
  cancel.onclick=()=> dlg.close();
}

/** -------------- HOME: multi grafici + filtro + PDF -------------- */
let charts={}; // {CH: chartInstance}

function fillFilter(){
  const sel=document.getElementById("filterSelect"); if(!sel) return;
  const channels=Object.keys(state.archive);
  sel.innerHTML="";
  const optAll=new Option("Tutti i CH","__ALL__",true,true);
  sel.appendChild(optAll);
  channels.forEach(ch=> sel.appendChild(new Option(ch,ch,false,false)));
  sel.onchange=()=> renderAllCharts(sel.value);
}

function chartTooltipAfterBodyFactory(rec){
  return (items)=>{
    const i=items[0].dataIndex; if(i<0||i>4) return;
    const key=["s1","s2","s3","s4","s5"][i];
    const det=rec.detail[key]||{}; const pts=parsePoints(INFO_TEXT[key]||"");
    const lines=Object.keys(det).map(n=>+n).sort((a,b)=>a-b).slice(0,6)
      .map(n=>`${n+1}) ${squares(det[n])} ${pts[n]||""}`);
    return lines.length?lines:["Nessuna nota selezionata"];
  };
}

function makeChartCard(ch){
  const rec=ensureCH(ch);
  const card=document.createElement("div");
  card.className="chart-card";
  card.innerHTML=`
    <h3>
      <span>${ch}</span>
      <span class="row">
        <button class="pill ghost" data-print="${ch}">Stampa PDF</button>
        <button class="pill ghost" data-open="${ch}">Apri in checklist</button>
      </span>
    </h3>
    <canvas id="chart-${CSS.escape(ch)}" height="120"></canvas>
  `;
  const ctx=card.querySelector("canvas");
  const vals=["s1","s2","s3","s4","s5"].map(k=>(rec.points[k]??0)*20);
  const delayed=Object.keys(rec.dates).filter(k=>isLate(ch,k)).length;

  if(charts[ch]) charts[ch].destroy();
  charts[ch]=new Chart(ctx,{
    type:"bar",
    data:{labels:["1S","2S","3S","4S","5S","Ritardi"],
      datasets:[{data:[...vals,delayed],backgroundColor:["#7c3aed","#ef4444","#f59e0b","#10b981","#2563eb","#ef4444"],borderWidth:0}]},
    options:{
      responsive:true,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:(it)=> it.dataIndex===5? `Ritardi: ${it.raw}` : `${it.label}: ${it.raw}%`,
                            afterBody:chartTooltipAfterBodyFactory(rec)}}
      },
      scales:{y:{beginAtZero:true,max:100,grid:{display:false},ticks:{callback:v=>v+"%"}},x:{grid:{display:false}}}
    }
  });

  // azioni
  card.querySelector(`[data-open="${CSS.escape(ch)}"]`).onclick=()=> location.href="checklist.html#"+encodeURIComponent(ch);
  card.querySelector(`[data-print="${CSS.escape(ch)}"]`).onclick=()=> printCHpdf(ch, ctx);

  return card;
}

function renderAllCharts(filter="__ALL__"){
  fillFilter(); // assicura popolamento
  const wrap=document.getElementById("chartsWrap"); if(!wrap) return;
  wrap.innerHTML="";
  const channels=Object.keys(state.archive).filter(ch=> filter==="__ALL__" ? true : ch===filter);
  if(!channels.length){ wrap.innerHTML='<p class="muted">Importa uno o più report JSON per vedere i grafici.</p>'; return; }
  channels.forEach(ch=> wrap.appendChild(makeChartCard(ch)));

  // Nav CH
  const nav=document.getElementById("channelsNav"); nav.innerHTML="";
  Object.keys(state.archive).forEach(ch=>{
    const b=document.createElement("button");
    b.className="ch-btn"; b.textContent=ch;
    b.onclick=()=> location.href="checklist.html#"+encodeURIComponent(ch);
    nav.appendChild(b);
  });
}

function setupHome(){
  document.getElementById("lockBtn")?.addEventListener("click",openPinDialog);

  document.getElementById("exportBtn")?.addEventListener("click",()=>{
    const pin=prompt("Inserisci PIN per esportare"); if(pin!==String(state.pin)) return;
    const arr=Object.entries(state.archive).map(([ch,rec])=>({version:"1.0",channel:ch,date:new Date().toISOString(),...rec}));
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(arr,null,2)],{type:"application/json"}));
    a.download=`SKF-5S_SUPERVISORE_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  });

  importSetup();
  renderAllCharts();
}

/** -------------- CHECKLIST: multi-CH + PDF -------------- */
function renderChecklistHeader(chCard, ch){
  const r=ensureCH(ch);
  const avg=Math.round(Object.values(r.points).reduce((a,b)=>a+b,0)/5*20);
  const late=Object.keys(r.dates).filter(k=>isLate(ch,k)).length;
  const chips=chCard.querySelectorAll(".kpis .chip");
  chips[0].textContent=`S1 ${r.points.s1*20}%`;
  chips[1].textContent=`S2 ${r.points.s2*20}%`;
  chips[2].textContent=`S3 ${r.points.s3*20}%`;
  chips[3].textContent=`S4 ${r.points.s4*20}%`;
  chips[4].textContent=`S5 ${r.points.s5*20}%`;
  chCard.querySelectorAll(".kpis .pill.ghost")[0].textContent=`Voto medio ${avg}%`;
  chCard.querySelectorAll(".kpis .pill.ghost")[1].textContent=`Ritardi ${late}`;
}

function renderOneCH(ch){
  const rec=ensureCH(ch);
  const wrap=document.createElement("section");
  wrap.className="ch-card"; wrap.dataset.ch=ch;

  const avg=Math.round(Object.values(rec.points).reduce((a,b)=>a+b,0)/5*20);
  const late=Object.keys(rec.dates).filter(k=>isLate(ch,k)).length;

  wrap.innerHTML=`
    <div class="ch-head">
      <div class="ch-title">${ch}</div>
      <div class="ch-ctrls">
        <div class="kpis">
          <span class="chip s1">S1 ${rec.points.s1*20}%</span>
          <span class="chip s2">S2 ${rec.points.s2*20}%</span>
          <span class="chip s3">S3 ${rec.points.s3*20}%</span>
          <span class="chip s4">S4 ${rec.points.s4*20}%</span>
          <span class="chip s5">S5 ${rec.points.s5*20}%</span>
          <span class="pill ghost">Voto medio ${avg}%</span>
          <span class="pill ghost">Ritardi ${late}</span>
        </div>
        <button class="pill ghost" data-printch="${ch}">Stampa PDF</button>
        <button class="pill ch-toggle">Comprimi / Espandi</button>
      </div>
    </div>
    <div class="sheets"></div>
  `;

  // 5 schede S
  const S=[
    {k:"s1",name:"1S — Selezionare",color:COLORS.s1},
    {k:"s2",name:"2S — Sistemare",color:COLORS.s2},
    {k:"s3",name:"3S — Splendere",color:COLORS.s3},
    {k:"s4",name:"4S — Standardizzare",color:COLORS.s4},
    {k:"s5",name:"5S — Sostenere",color:COLORS.s5},
  ];
  const today=()=> new Date().toISOString().slice(0,10);
  const sheets=wrap.querySelector(".sheets");

  S.forEach(({k,name,color})=>{
    const val=rec.points[k]??0; const lateS=isLate(ch,k);
    const art=document.createElement("article");
    art.className="sheet"+(lateS?" late":""); art.id=`${ch}::${k}`;
    art.innerHTML=`
      <div class="sheet-head">
        <span class="s-color" style="background:${color}"></span>
        <h3 class="s-title" style="color:${color}">${name}</h3>
        <span class="s-value">Valore: ${val*20}%</span>
        <button class="icon info" data-k="${k}" data-ch="${ch}">i</button>
        <button class="icon add">+</button>
      </div>

      <details class="s-details" open>
        <summary>▼ Dettagli</summary>

        <label class="field">
          <span>Responsabile / Operatore</span>
          <input placeholder="Inserisci il nome...">
        </label>

        <label class="field">
          <span>Note</span>
          <textarea rows="3" placeholder="Note...">${rec.notes[k]||""}</textarea>
        </label>

        <div class="field">
          <span>Data</span>
          <div class="row">
            <input type="date" data-ch="${ch}" data-k="${k}" value="${rec.dates[k]||today()}">
            <div class="points">
              ${[0,1,3,5].map(p=>`<button data-ch="${ch}" data-k="${k}" data-p="${p}" class="${val===p?'active':''}">${p}</button>`).join("")}
            </div>
            <button class="icon danger del">🗑</button>
          </div>
        </div>
      </details>
    `;
    sheets.appendChild(art);
  });

  // comprimi/espandi CH (mostra solo KPIs)
  wrap.querySelector(".ch-toggle").onclick=()=> wrap.classList.toggle("collapsed");

  // stampa PDF CH
  wrap.querySelector(`[data-printch="${CSS.escape(ch)}"]`).onclick=()=> printCHpdf(ch);

  // set punti
  wrap.addEventListener("click",(e)=>{
    const btn=e.target.closest(".points button"); if(!btn) return;
    const kc=btn.dataset.k; const chn=btn.dataset.ch; const p=Number(btn.dataset.p);
    const r=ensureCH(chn); r.points[kc]=p; save();
    btn.parentElement.querySelectorAll("button").forEach(b=> b.classList.toggle("active", b===btn));
    btn.closest(".sheet").querySelector(".s-value").textContent=`Valore: ${p*20}%`;
    renderChecklistHeader(wrap, chn);
  });

  // date → ritardo
  wrap.addEventListener("change",(e)=>{
    const d=e.target.closest('input[type="date"][data-ch]'); if(!d) return;
    const r=ensureCH(d.dataset.ch); r.dates[d.dataset.k]=d.value; save();
    d.closest(".sheet").classList.toggle("late", isLate(d.dataset.ch,d.dataset.k));
    renderChecklistHeader(wrap, d.dataset.ch);
  });

  // reset scheda (PIN)
  wrap.addEventListener("click",(e)=>{
    const del=e.target.closest(".del"); if(!del) return;
    const pin=prompt("PIN per eliminare"); if(pin!==String(state.pin)) return;
    const sheet=del.closest(".sheet");
    const [chn,kc]=sheet.id.split("::");
    const r=ensureCH(chn);
    r.points[kc]=0; r.notes[kc]=""; r.dates[kc]=null; r.detail[kc]={}; save();
    sheet.querySelectorAll(".points button").forEach(b=> b.classList.remove("active"));
    sheet.querySelector(".s-value").textContent="Valore: 0%";
    sheet.querySelector("textarea").value="";
    sheet.classList.remove("late");
    renderChecklistHeader(wrap, chn);
  });

  // info
  wrap.addEventListener("click",(e)=>{
    const info=e.target.closest(".info"); if(!info) return;
    openInfo(info.dataset.ch, info.dataset.k);
  });

  return wrap;
}

function setupChecklist(){
  document.getElementById("lockBtn")?.addEventListener("click",openPinDialog);

  const host=document.getElementById("channelsWrap");
  host.innerHTML="";
  const chList=Object.keys(state.archive);
  if(!chList.length){ host.innerHTML='<p class="muted">Importa i report dei CH dalla home.</p>'; return; }
  const targetCH=location.hash? decodeURIComponent(location.hash.slice(1)) : null;

  chList.forEach(ch=> host.appendChild(renderOneCH(ch)));
  if(targetCH){ document.querySelector(`[data-ch="${CSS.escape(targetCH)}"]`)?.scrollIntoView({behavior:"smooth",block:"start"}); }

  // comprimi/espandi TUTTI i CH
  document.getElementById("toggleAllCH")?.addEventListener("click", ()=>{
    const cards=[...document.querySelectorAll(".ch-card")];
    const someOpen=cards.some(c=>!c.classList.contains("collapsed"));
    cards.forEach(c=> c.classList.toggle("collapsed", someOpen));
  });

  importSetup();
}

/** -------------- INFO dialog -------------- */
function openInfo(ch,k){
  const dlg=document.getElementById("infoDialog");
  const title=document.getElementById("infoTitle");
  const content=document.getElementById("infoContent");
  const rec=ensureCH(ch);
  title.textContent=`${k.toUpperCase()} — Info`;
  content.innerHTML="";
  const pts=parsePoints(INFO_TEXT[k]||"");

  const ol=document.createElement("ol");
  pts.forEach((txt,idx)=>{
    const li=document.createElement("li");
    const chosen=rec.detail[k]?.[idx] ?? null;
    li.innerHTML=`
      <div class="pointline">
        <div>${idx+1}. ${txt}</div>
        <div class="pick" data-ch="${ch}" data-k="${k}" data-idx="${idx}">
          ${[0,1,3,5].map(v=>`<button type="button" data-score="${v}" class="${chosen===v?'picked':''}">${v}</button>`).join("")}
        </div>
        <div class="note-mini">Seleziona per aggiungere la riga colorata nelle Note.</div>
      </div>`;
    ol.appendChild(li);
  });
  content.appendChild(ol);
  dlg.querySelector(".modal-box").style.borderTop=`6px solid ${COLORS[k]}`;
  dlg.showModal();

  content.onclick=(e)=>{
    const b=e.target.closest(".pick button"); if(!b) return;
    const pick=b.closest(".pick"); const score=+b.dataset.score;
    const chn=pick.dataset.ch; const key=pick.dataset.k; const idx=+pick.dataset.idx;
    pick.querySelectorAll("button").forEach(x=> x.classList.toggle("picked", x===b));

    const R=ensureCH(chn); if(!R.detail[key]) R.detail[key]={};
    R.detail[key][idx]=score;

    const txt=parsePoints(INFO_TEXT[key]||"")[idx] || "";
    const ta=document.querySelector(`#${CSS.escape(chn)}\\:\\:${key} textarea`);
    if(ta){
      const line=`${squares(score)} — ${txt}`;
      ta.value=(ta.value?ta.value.replace(/\s*$/,"")+"\n":"")+line;
      R.notes[key]=ta.value;
    }

    // media → punto scheda
    const arr=Object.values(R.detail[key]); const mean=arr.reduce((a,b)=>a+b,0)/arr.length;
    const pt=nearestScore(mean); R.points[key]=pt;

    // riflessi UI
    const sheet=document.getElementById(`${chn}::${key}`);
    sheet.querySelectorAll(".points button").forEach(x=> x.classList.toggle("active", +x.dataset.p===pt));
    sheet.querySelector(".s-value").textContent=`Valore: ${pt*20}%`;

    save();
    renderChecklistHeader(sheet.closest(".ch-card"), chn);
    if(document.getElementById("chartsWrap")) renderAllCharts(document.getElementById("filterSelect")?.value || "__ALL__");
  };
}

/** -------------- PDF -------------- */
async function printCHpdf(ch, chartCanvas){
  const rec=ensureCH(ch);
  // jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });

  const margin=40, lineH=16;
  let y=margin;

  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text(`SKF 5S — Report ${ch}`, margin, y); y+=26;

  // KPI
  doc.setFontSize(12); doc.setFont('helvetica','normal');
  const kpis = `S1 ${rec.points.s1*20}%    S2 ${rec.points.s2*20}%    S3 ${rec.points.s3*20}%    S4 ${rec.points.s4*20}%    S5 ${rec.points.s5*20}%`;
  doc.text(kpis, margin, y); y+=lineH;

  // Ritardi
  const late=Object.keys(rec.dates).filter(k=>isLate(ch,k)).length;
  doc.text(`Ritardi: ${late}`, margin, y); y+=lineH;

  // Grafico (se disponibile in home)
  try{
    let dataUrl=null;
    if(chartCanvas){ dataUrl=chartCanvas.toDataURL('image/png',1.0); }
    else{
      // crea mini chart invisibile (in checklist)
      const cvs=document.createElement('canvas'); cvs.width=600; cvs.height=280;
      const vals=["s1","s2","s3","s4","s5"].map(k=>(rec.points[k]??0)*20);
      new Chart(cvs,{type:"bar",data:{labels:["1S","2S","3S","4S","5S"],datasets:[{data:vals,backgroundColor:["#7c3aed","#ef4444","#f59e0b","#10b981","#2563eb"]}]},
        options:{responsive:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}});
      dataUrl=cvs.toDataURL('image/png',1.0);
    }
    if(dataUrl){ doc.addImage(dataUrl,'PNG',margin,y,535,250); y+=260; }
  }catch{}

  // Note riassunte
  doc.setFont('helvetica','bold'); doc.text("Note:", margin, y); y+=lineH;
  doc.setFont('helvetica','normal');
  ["s1","s2","s3","s4","s5"].forEach(k=>{
    const lines=(rec.notes[k]||"").split(/\r?\n/).filter(Boolean).slice(0,10);
    if(!lines.length) return;
    doc.setTextColor(...hexToRgb(COLORS[k])); doc.text(k.toUpperCase()+":", margin, y); y+=lineH;
    doc.setTextColor(0,0,0);
    lines.forEach(t=>{
      const splitted=doc.splitTextToSize(t, 535);
      splitted.forEach(row=>{ doc.text(row, margin+20, y); y+=lineH; if(y>780){ doc.addPage(); y=margin; }});
    });
    y+=6;
  });

  doc.save(`SKF-5S_${ch}_${new Date().toISOString().slice(0,10)}.pdf`);
}
function hexToRgb(hex){
  const n=parseInt(hex.slice(1),16); return [ (n>>16)&255, (n>>8)&255, n&255 ];
}

/** -------------- IMPORT -------------- */
function normalizePointsObject(points){
  const out={s1:0,s2:0,s3:0,s4:0,s5:0};
  if(!points||typeof points!=="object") return out;
  for(const k of ["s1","s2","s3","s4","s5"]){
    let v=points[k]; if(v==null) v=0;
    if(typeof v==="string") v=v.trim().replace("%","");
    v=+v; if(isNaN(v)) v=0; if(v>5) v=Math.round(v/20);
    v=Math.min(5,Math.max(0,v)); out[k]=v;
  }
  return out;
}
function normalizeRecord(obj){
  if(!obj||typeof obj!=="object") return null;
  const ch=String(obj.channel||"CH");
  return {
    channel: ch,
    points: normalizePointsObject(obj.points),
    notes: obj.notes && typeof obj.notes==="object" ? obj.notes : {s1:"",s2:"",s3:"",s4:"",s5:""},
    dates: obj.dates && typeof obj.dates==="object" ? obj.dates : {s1:null,s2:null,s3:null,s4:null,s5:null},
    detail: obj.detail && typeof obj.detail==="object" ? obj.detail : {s1:{},s2:{},s3:{},s4:{},s5:{}}
  };
}
function importSetup(){
  let fin=document.getElementById("lineImportInput");
  if(!fin){ fin=document.createElement("input"); fin.type="file"; fin.accept="application/json"; fin.id="lineImportInput"; fin.style.display="none"; document.body.appendChild(fin); }
  const btn=document.getElementById("importBtn");
  btn && btn.addEventListener("click",()=> fin.click());

  fin.addEventListener("change", async (ev)=>{
    const f=ev.target.files?.[0]; if(!f) return;
    try{
      const any=JSON.parse(await f.text());
      let records=[];
      if(Array.isArray(any)) records = any.map(normalizeRecord).filter(Boolean);
      else records=[normalizeRecord(any)].filter(Boolean);
      if(!records.length){ alert("File non valido"); return; }
      records.forEach(r=>{ state.archive[r.channel]={points:r.points,notes:r.notes,dates:r.dates,detail:r.detail}; });
      save();
      alert(`Import OK: ${records.map(r=>r.channel).join(", ")}`);
      if(document.getElementById("chartsWrap")) renderAllCharts(document.getElementById("filterSelect")?.value || "__ALL__");
      if(document.getElementById("channelsWrap")) location.reload();
    }catch(e){ console.error(e); alert("File non valido"); }
    finally{ ev.target.value=""; }
  });
}

/** -------------- ROUTER -------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  if (document.body.dataset.page==="home") setupHome();
  if (document.body.dataset.page==="checklist") setupChecklist();
});
