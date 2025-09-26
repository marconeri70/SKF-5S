/** ========= CONFIG ========= */
const CONFIG = {
  AREA: "Rettifica",             // Cambia in "Montaggio" per l'altra repo
  CHANNEL_DEFAULT: "CH 24",
  DEFAULT_PIN: "6170"
};
const COLORS = { s1:"#7c3aed", s2:"#ef4444", s3:"#f59e0b", s4:"#10b981", s5:"#2563eb" };

/** ========= INFO TESTI (compatti) ========= */
const INFO_TEXT = {
  s1:"(1) Area pedonale libera da ostacoli. (2) Nessun materiale non identificato a pavimento. (3) Solo materiali/strumenti necessari: il resto è rimosso. (4) Solo materiale necessario per il lavoro in corso. (5) Documenti/visual aggiornati e in buono stato. (6) Team e processo etichetta rossa definiti. (7) Lavagna 5S aggiornata (piano/foto/audit). (8) Evidenze sostenibilità 1S. (9) 5S/1S compresi; responsabilità definite. (10) Tutti partecipano.",
  s2:"(1) Area/team definiti; niente cose inutili. (2) Sicurezza segnalata e accessibile. (3) Emergenze visibili/libere. (4) Stazioni qualità organizzate. (5) SWC seguito. (6) Posizioni e min/max per utenze/strumenti/pulizia. (7) Posizioni chiare per contenitori/rifiuti. (8) WIP/accettati/rifiutati/quarantena identificati. (9) Materie prime/componenti con posizioni designate. (10) Layout corridoi/DPI. (11) Documenti al punto d’uso. (12) Miglioramenti one-touch/poka-yoke/ergonomia. (13) Evidenze sostenibilità 2S. (14) 5S/2S compresi; responsabilità definite.",
  s3:"(1) Niente cose inutili. (2) Miglioramenti 2S mantenuti. (3) Verifiche regolari e azioni. (4) 1S/2S compresi. (5) Pavimenti/pareti puliti. (6) Segnali puliti e leggibili. (7) Documenti protetti. (8) Luci/ventilazione ok. (9) Fonti sporco note. (10) Piano per eliminarle. (11) Azioni eseguite. (12) Prevenzione pulizia. (13) Riciclo attivo. (14) Demarcazioni permanenti. (15) Evidenze sostenibilità 3S.",
  s4:"(1) Visual mgmt/Min-Max a vista. (2) Colori standard per lubrificazioni/tubi/valvole. (3) Standard 5S consolidati e aggiornati. (4) Istruzioni integrate nella gestione quotidiana.",
  s5:"(1) Tutti formati e coinvolti. (2) 5S come abitudine. (3) Layered audit programmati. (4) Foto prima/dopo mantenute. (5) Obiettivi 5S in evidenza."
};

/** ========= STORAGE HELPERS ========= */
const K = (k)=>`skf5s:${CONFIG.AREA}:${k}`;
const Jget=(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
const Jset=(k,v)=> localStorage.setItem(k, JSON.stringify(v));

/** ========= SERVICE WORKER ========= */
if ("serviceWorker" in navigator){
  addEventListener("load", ()=> navigator.serviceWorker.register("sw.js"));
}

/** ========= STATO =========
 * archivio multi-CH:
 * state.archive = { "CH 24": {points,notes,dates,detail}, "CH 25": {...}, ... }
 */
let state = Jget(K("state"), {
  pin: Jget("skf5s:pin", CONFIG.DEFAULT_PIN),
  active: CONFIG.CHANNEL_DEFAULT,
  archive: {}   // viene popolato all'uso
});
function savePin(p){ state.pin=p; Jset("skf5s:pin",p); Jset(K("state"),state); }

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

/** ========= TITOLI ========= */
function refreshTitles(){
  const t = document.getElementById("chartTitle");
  if (t) t.textContent = `Andamento ${state.active} — ${CONFIG.AREA}`;
}

/** ========= PIN DIALOG ========= */
function openPinDialog(){
  const dlg = document.getElementById("pinDialog");
  if(!dlg) return;
  const pinInput = document.getElementById("pinInput");
  const channelInput = document.getElementById("channelInput");
  const np1 = document.getElementById("newPin1");
  const np2 = document.getElementById("newPin2");
  const ok = document.getElementById("pinConfirmBtn");
  const cancel = document.getElementById("pinCancel");

  pinInput.value=""; channelInput.value = state.active; np1.value=""; np2.value="";
  dlg.showModal();

  ok.onclick = ()=>{
    if (pinInput.value !== String(state.pin)) { alert("PIN errato"); return; }
    state.active = (channelInput.value||CONFIG.CHANNEL_DEFAULT).trim();
    if (np1.value || np2.value){
      if (np1.value !== np2.value) { alert("I due PIN non coincidono"); return; }
      if (!/^\d{3,8}$/.test(np1.value)) { alert("PIN non valido"); return; }
      savePin(np1.value);
    }
    ensureCH(state.active);
    Jset(K("state"), state);
    refreshTitles();
    dlg.close();
    location.reload();
  };
  cancel.onclick = ()=> dlg.close();
}

/** ========= UTILITY RITARDI & NOTE ========= */
function isLate(ch,k){
  const d = ensureCH(ch).dates[k];
  if(!d) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d); due.setHours(0,0,0,0);
  return due < today;
}
const parsePoints = (txt)=>{
  const out=[]; const re=/\((\d+)\)\s*([^]+?)(?=\s*\(\d+\)\s*|$)/g; let m;
  while((m=re.exec(txt))) out.push(m[2].trim());
  return out;
};
const squares = (score)=> [0,1,3,5].map(v=> v===score?`🟦${v}`:`⬜${v}`).join(" ");
function nearestScore(mean){ const c=[0,1,3,5]; return c.reduce((a,b)=> Math.abs(b-mean)<Math.abs(a-mean)?b:a,0); }

/** ========= HOME ========= */
let chart;
function renderChart(){
  const ctx = document.getElementById("progressChart"); if(!ctx) return;
  const rec = ensureCH(state.active);
  const vals = ["s1","s2","s3","s4","s5"].map(k=> (rec.points[k]??0)*20 );
  const delayed = Object.keys(rec.dates).filter(k=> isLate(state.active,k)).length;

  if(chart) chart.destroy();
  chart = new Chart(ctx,{
    type:"bar",
    data:{ labels:["1S","2S","3S","4S","5S","Ritardi"],
      datasets:[{ data:[...vals, delayed],
        backgroundColor:["#7c3aed","#ef4444","#f59e0b","#10b981","#2563eb","#ef4444"], borderWidth:0 }]},
    options:{
      responsive:true,
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            label:(it)=> it.dataIndex===5? `Ritardi: ${it.raw}` : `${it.label}: ${it.raw}%`,
            afterBody:(items)=>{
              const i=items[0].dataIndex; if(i<0||i>4) return;
              const key=["s1","s2","s3","s4","s5"][i];
              const det=rec.detail[key]||{}; const pts=parsePoints(INFO_TEXT[key]||"");
              const lines=Object.keys(det).map(n=>+n).sort((a,b)=>a-b).slice(0,6)
                .map(n=>`${n+1}) ${squares(det[n])} ${pts[n]||""}`);
              return lines.length?lines:["Nessuna nota selezionata"];
            }
          }
        }
      },
      scales:{y:{beginAtZero:true,max:100,grid:{display:false},ticks:{callback:v=>v+"%"}},x:{grid:{display:false}}}
    }
  });

  // pulsanti in ritardo
  const lateBox = document.getElementById("lateBtns"); if(!lateBox) return;
  lateBox.innerHTML="";
  ["s1","s2","s3","s4","s5"].forEach((k,i)=>{
    if (isLate(state.active,k)){
      const b=document.createElement("button");
      b.className=`late-btn ${k}`; b.style.borderColor=COLORS[k]; b.textContent=`${i+1}S in ritardo`;
      b.onclick=()=> location.href="checklist.html#"+encodeURIComponent(state.active)+"::"+k;
      lateBox.appendChild(b);
    }
  });
}
function setupHome(){
  refreshTitles();
  ensureCH(state.active);
  renderChart();
  document.getElementById("lockBtn")?.addEventListener("click",openPinDialog);
  document.getElementById("exportBtn")?.addEventListener("click",()=>{
    const pin=prompt("Inserisci PIN per esportare"); if(pin!==String(state.pin)) return;
    const rec = ensureCH(state.active);
    const payload = {version:"1.0", area:CONFIG.AREA, channel:state.active, date:new Date().toISOString(), ...rec};
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
    a.download=`SKF-5S_${CONFIG.AREA}_${state.active}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
}

/** ========= CHECKLIST (MULTI-CH) ========= */
function renderOneCH(ch){
  const rec = ensureCH(ch);
  const wrap = document.createElement("section");
  wrap.className="ch-card"; wrap.dataset.ch=ch;

  // KPI card head
  const avg = Math.round(Object.values(rec.points).reduce((a,b)=>a+b,0)/5*20);
  const late = Object.keys(rec.dates).filter(k=>isLate(ch,k)).length;

  wrap.innerHTML = `
    <div class="ch-head">
      <div class="ch-title">${ch} — ${CONFIG.AREA}</div>
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
        <button class="pill ch-toggle">Comprimi / Espandi</button>
      </div>
    </div>
    <div class="sheets"></div>
  `;

  // 5 schede S
  const S = [
    {k:"s1", name:"1S — Selezionare",   color:COLORS.s1},
    {k:"s2", name:"2S — Sistemare",     color:COLORS.s2},
    {k:"s3", name:"3S — Splendere",     color:COLORS.s3},
    {k:"s4", name:"4S — Standardizzare",color:COLORS.s4},
    {k:"s5", name:"5S — Sostenere",     color:COLORS.s5},
  ];
  const today=()=> new Date().toISOString().slice(0,10);
  const sheets = wrap.querySelector(".sheets");

  S.forEach(({k,name,color})=>{
    const val = rec.points[k]??0;
    const lateS = isLate(ch,k);
    const art = document.createElement("article");
    art.className = "sheet"+(lateS?" late":""); art.id=`${ch}::${k}`;
    art.innerHTML = `
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

  // eventi interni CH
  // toggle CH (apre/chiude tutte le details)
  wrap.querySelector(".ch-toggle").onclick = ()=>{
    const anyOpen = [...wrap.querySelectorAll(".s-details")].some(d=>d.open);
    wrap.querySelectorAll(".s-details").forEach(d=> d.open = !anyOpen);
  };

  // set punti
  wrap.addEventListener("click",(e)=>{
    const btn = e.target.closest(".points button"); if(!btn) return;
    const kc = btn.dataset.k; const chn = btn.dataset.ch; const p=Number(btn.dataset.p);
    const r = ensureCH(chn); r.points[kc]=p; Jset(K("state"),state);
    btn.parentElement.querySelectorAll("button").forEach(b=> b.classList.toggle("active", b===btn));
    wrap.querySelector(`#\\3A ${chn}::${kc.replace('s','s')}`); // safe noop
    btn.closest(".sheet").querySelector(".s-value").textContent = `Valore: ${p*20}%`;
    renderChecklistHeader(wrap, chn);
  });

  // date → ritardo
  wrap.addEventListener("change",(e)=>{
    const d = e.target.closest('input[type="date"][data-ch]'); if(!d) return;
    const r=ensureCH(d.dataset.ch); r.dates[d.dataset.k]=d.value; Jset(K("state"),state);
    d.closest(".sheet").classList.toggle("late", isLate(d.dataset.ch,d.dataset.k));
    renderChecklistHeader(wrap, d.dataset.ch);
  });

  // delete reset scheda
  wrap.addEventListener("click",(e)=>{
    const del = e.target.closest(".del"); if(!del) return;
    const pin = prompt("PIN per eliminare"); if (pin!==String(state.pin)) return;
    const sheet = del.closest(".sheet");
    const [chn,kc] = sheet.id.split("::");
    const r=ensureCH(chn);
    r.points[kc]=0; r.notes[kc]=""; r.dates[kc]=null; r.detail[kc]={}; Jset(K("state"),state);
    sheet.querySelectorAll(".points button").forEach(b=> b.classList.remove("active"));
    sheet.querySelector(".s-value").textContent="Valore: 0%";
    sheet.querySelector("textarea").value="";
    sheet.classList.remove("late");
    renderChecklistHeader(wrap, chn);
  });

  // info
  wrap.addEventListener("click",(e)=>{
    const info = e.target.closest(".info"); if(!info) return;
    openInfo(info.dataset.ch, info.dataset.k);
  });

  return wrap;
}

// aggiorna KPI nel titolo CH
function renderChecklistHeader(chCard, ch){
  const r=ensureCH(ch);
  const avg = Math.round(Object.values(r.points).reduce((a,b)=>a+b,0)/5*20);
  const late = Object.keys(r.dates).filter(k=>isLate(ch,k)).length;
  const chips = chCard.querySelectorAll(".kpis .chip");
  chips[0].textContent=`S1 ${r.points.s1*20}%`;
  chips[1].textContent=`S2 ${r.points.s2*20}%`;
  chips[2].textContent=`S3 ${r.points.s3*20}%`;
  chips[3].textContent=`S4 ${r.points.s4*20}%`;
  chips[4].textContent=`S5 ${r.points.s5*20}%`;
  chCard.querySelectorAll(".kpis .pill.ghost")[0].textContent=`Voto medio ${avg}%`;
  chCard.querySelectorAll(".kpis .pill.ghost")[1].textContent=`Ritardi ${late}`;
}

function setupChecklist(){
  // bottone lock nella appbar
  document.getElementById("lockBtn")?.addEventListener("click", openPinDialog);

  // render di TUTTI i CH presenti
  const host = document.getElementById("channelsWrap");
  host.innerHTML="";
  const chList = Object.keys(state.archive).length ? Object.keys(state.archive) : [state.active];
  chList.forEach(ch=>{
    ensureCH(ch);
    host.appendChild(renderOneCH(ch));
  });

  // comprimi/espandi TUTTI i CH
  document.getElementById("toggleAllCH")?.addEventListener("click", ()=>{
    const cards=[...document.querySelectorAll(".ch-card")];
    const someOpen = cards.some(c=> [...c.querySelectorAll(".s-details")].some(d=>d.open));
    cards.forEach(c=> c.querySelectorAll(".s-details").forEach(d=> d.open = !someOpen));
  });

  // se arriviamo con #CH::sX scorri alla scheda
  if (location.hash){
    const id = decodeURIComponent(location.hash.slice(1));
    document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"});
  }
}

/** ========= POPUP INFO (inserimento in Note e media) ========= */
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
    li.innerHTML = `
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

    const rec=ensureCH(chn); if(!rec.detail[key]) rec.detail[key]={};
    rec.detail[key][idx]=score;

    // append nota con riquadri colorati
    const txt=parsePoints(INFO_TEXT[key]||"")[idx] || "";
    const ta=document.querySelector(`#${CSS.escape(chn)}\\:\\:${key} textarea`);
    if (ta){
      const line=`${squares(score)} — ${txt}`;
      ta.value = (ta.value?ta.value.replace(/\s*$/,"")+"\n":"")+line;
      rec.notes[key]=ta.value;
    }

    // media → punto scheda
    const arr=Object.values(rec.detail[key]); const mean=arr.reduce((a,b)=>a+b,0)/arr.length;
    const pt=nearestScore(mean); rec.points[key]=pt;

    // riflessi UI
    const sheet=document.getElementById(`${chn}::${key}`);
    sheet.querySelectorAll(".points button").forEach(x=> x.classList.toggle("active", +x.dataset.p===pt));
    sheet.querySelector(".s-value").textContent=`Valore: ${pt*20}%`;

    Jset(K("state"),state);
    renderChecklistHeader(sheet.closest(".ch-card"), chn);
  };
}

/** ========= IMPORT / EXPORT (multi-CH) ========= */
function normalizePointsObject(points){
  const out={s1:0,s2:0,s3:0,s4:0,s5:0};
  if (!points||typeof points!=="object") return out;
  for(const k of ["s1","s2","s3","s4","s5"]){
    let v=points[k]; if(v==null) v=0;
    if(typeof v==="string") v=v.trim().replace("%","");
    v=+v; if(isNaN(v)) v=0; if(v>5) v=Math.round(v/20);
    v=Math.min(5,Math.max(0,v)); out[k]=v;
  }
  return out;
}
function normalizeRecord(obj, fallbackChannel){
  if(!obj||typeof obj!=="object") return null;
  const ch=String(obj.channel||fallbackChannel||CONFIG.CHANNEL_DEFAULT);
  return {
    channel: ch,
    points: normalizePointsObject(obj.points),
    notes: obj.notes && typeof obj.notes==="object" ? obj.notes : {s1:"",s2:"",s3:"",s4:"",s5:""},
    dates: obj.dates && typeof obj.dates==="object" ? obj.dates : {s1:null,s2:null,s3:null,s4:null,s5:null},
    detail: obj.detail && typeof obj.detail==="object" ? obj.detail : {s1:{},s2:{},s3:{},s4:{},s5:{}}
  };
}
function importSetup(){
  // Aggiungo input file invisibile se manca
  let fin=document.getElementById("lineImportInput");
  if(!fin){ fin=document.createElement("input"); fin.type="file"; fin.accept="application/json";
    fin.id="lineImportInput"; fin.style.display="none"; document.body.appendChild(fin); }
  const btn=document.getElementById("importBtn");
  btn && btn.addEventListener("click",()=> fin.click());

  fin.addEventListener("change", async (ev)=>{
    const f=ev.target.files?.[0]; if(!f) return;
    try{
      const any=JSON.parse(await f.text());
      let records=[];
      if(Array.isArray(any)) records = any.map(o=>normalizeRecord(o,state.active)).filter(Boolean);
      else records = [normalizeRecord(any,state.active)].filter(Boolean);

      if(!records.length){ alert("File non valido"); return; }

      // merge nell'archivio
      records.forEach(r=>{
        state.archive[r.channel] = {
          points:r.points, notes:r.notes, dates:r.dates, detail:r.detail
        };
      });
      // attiva un CH (se import multiplo chiedi)
      let target=records[0].channel;
      if(records.length>1){
        const list=records.map(r=>r.channel).join(", ");
        const pick=prompt(`Import completato. Quale CH vuoi attivare? (${list})`, state.active||records[0].channel);
        if(pick && state.archive[pick]) target=pick;
      }
      state.active = target;
      ensureCH(state.active);
      Jset(K("state"),state);
      alert(`Import OK. Attivo: ${state.active}`);
      location.reload();
    }catch(e){ console.error(e); alert("File non valido"); }
    finally{ ev.target.value=""; }
  });
}

/** ========= SUPERVISOR NOTES (se usi notes.html) ========= */
function renderSupervisorCards(){} // non usato in questa consegna

/** ========= ROUTER ========= */
document.addEventListener("DOMContentLoaded", ()=>{
  if (document.body.dataset.page==="home"){ refreshTitles(); ensureCH(state.active); importSetup(); setupHome(); }
  if (document.body.dataset.page==="checklist"){ importSetup(); setupChecklist(); }
});
