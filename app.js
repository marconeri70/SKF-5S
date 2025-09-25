/** CONFIGURAZIONE */
const CONFIG = {
  AREA: "Rettifica",           // Per Montaggio cambia qui in "Montaggio"
  CHANNEL_DEFAULT: "CH 24",
  DEFAULT_PIN: "6170"
};
const COLORS = {
  s1:"#7c3aed", s2:"#ef4444", s3:"#f59e0b", s4:"#10b981", s5:"#2563eb"
};

/** TESTI INFO – formato "(1) ... (2) ... (3) ..." */
const INFO_TEXT = {
  s1: "(1) L'area pedonale è libera da ostacoli e pericoli di inciampo. (2) Nessun materiale/attrezzo non identificato sul pavimento. (3) Solo materiali/strumenti necessari presenti; il resto è rimosso. (4) Solo materiale necessario per il lavoro in corso. (5) Documenti/visualizzazioni necessari, aggiornati, in buono stato. (6) Definiti team e processo etichetta rossa; processo attivo. (7) Lavagna 5S aggiornata (piano, foto prima/dopo, audit). (8) Evidenze che garantiscono la sostenibilità di 1S. (9) 5S/1S compresi dal team; responsabilità definite. (10) Tutti i membri partecipano alle attività dell'area.",
  s2: "(1) Area e team definiti; nessuna cosa non necessaria in zona. (2) Articoli di sicurezza chiaramente contrassegnati e accessibili. (3) Uscite/interruttori emergenza visibili e liberi. (4) Stazioni qualità definite e organizzate. (5) SWC seguito. (6) Posizioni prefissate per utenze/strumenti/pulizia con indicatori min/max. (7) Posizioni definite per contenitori e rifiuti con identificazione chiara. (8) WIP/accettati/rifiutati/quarantena con posizioni e identificazione. (9) Materie prime/componenti con posizioni designate. (10) Layout con corridoi/aree/pedonali e DPI definito. (11) File/documenti identificati e organizzati al punto d'uso. (12) Miglioramenti one-touch/poka-yoke/ergonomia. (13) Evidenze di sostenibilità 2S. (14) 5S/2S compresi; responsabilità definite. (15) Partecipazione di tutti.",
  s3: "(1) Non si trovano cose inutili. (2) Miglioramenti 2S mantenuti. (3) Verifiche regolari e azioni su deviazioni. (4) Area/team definiti; 1S/2S compresi. (5) Pavimenti/pareti puliti e senza detriti/oli/trucioli ecc. (6) Segnali/etichette puliti, corretti e leggibili. (7) Documenti in buone condizioni e protetti. (8) Luci/ventilazione/AC in ordine e pulite. (9) Fonti sporco identificate e note. (10) Piani d'azione per eliminare fonti sporco. (11) Azioni eseguite. (12) Miglioramenti per prevenire pulizia (meno tappe, eliminazione fonte). (13) Riciclaggio attivo con corretto smistamento. (14) Demarcazioni rese permanenti. (15) Evidenze di sostenibilità 3S. (16) 5S/3S compresi; responsabilità definite; partecipazione di tutti.",
  s4: "(1) Visual management/kanban/Min-Max implementati (gestire a vista). (2) Colori/segni standard per lubrificazioni, tubazioni, valvole, ecc. (3) Standard 5S consolidati e aggiornati come training/guida. (4) Istruzioni 5S integrate nella gestione quotidiana.",
  s5: "(1) Tutti formati sugli standard 5S e coinvolti. (2) 5S come abitudine; standard seguiti da tutti. (3) Layered audit programmati. (4) Foto prima/dopo mantenute come riferimento. (5) Obiettivi 5S esposti."
};

/** Helpers storage */
const storageKey = k => `skf5s:${CONFIG.AREA}:${k}`;
const getJSON = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
const setJSON = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

/** Service worker */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", ()=> navigator.serviceWorker.register("sw.js"));
}

/** Stato */
let state = getJSON(storageKey("state"), {
  channel: CONFIG.CHANNEL_DEFAULT,
  pin: getJSON("skf5s:pin", CONFIG.DEFAULT_PIN),
  points: { s1:0, s2:0, s3:0, s4:0, s5:0 },
  notes:  { s1:"", s2:"", s3:"", s4:"", s5:"" },
  dates:  { s1:null, s2:null, s3:null, s4:null, s5:null },
  // scelte dei punti nel popup, per calcolare la media
  detail: { s1:{}, s2:{}, s3:{}, s4:{}, s5:{} }   // es. detail.s1[0]=3  -> punto #1 di S1 valutato 3
});
function savePin(p){ state.pin = p; setJSON(storageKey("state"), state); localStorage.setItem("skf5s:pin", JSON.stringify(p)); }

/** Titoli dinamici */
function refreshTitles(){
  const chartTitle = document.getElementById("chartTitle");
  if (chartTitle) chartTitle.textContent = `Andamento ${state.channel} — ${CONFIG.AREA}`;
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) pageTitle.textContent = `${state.channel} — ${CONFIG.AREA}`;
}

/** PIN dialog (con cambio PIN offline) */
function openPinDialog(){
  const dlg = document.getElementById("pinDialog");
  if (!dlg) return;

  dlg.showModal();
  const pinInput = document.getElementById("pinInput");
  const chInput  = document.getElementById("channelInput");
  const np1 = document.getElementById("newPin1");
  const np2 = document.getElementById("newPin2");
  const okBtn = document.getElementById("pinConfirmBtn");
  const cancel = document.getElementById("pinCancel");

  pinInput.value = "";
  chInput.value = state.channel ?? CONFIG.CHANNEL_DEFAULT;
  np1.value = ""; np2.value = "";

  okBtn.onclick = ()=>{
    const entered = pinInput.value.trim();
    if (entered !== String(state.pin)) { alert("PIN errato"); return; }
    state.channel = chInput.value.trim() || CONFIG.CHANNEL_DEFAULT;

    if (np1.value || np2.value){
      if (np1.value !== np2.value) { alert("I due PIN non coincidono"); return; }
      if (!/^\d{3,8}$/.test(np1.value)) { alert("PIN non valido"); return; }
      savePin(np1.value);
    }
    setJSON(storageKey("state"), state);
    refreshTitles();
    dlg.close();
  };
  cancel.onclick = ()=> dlg.close();
}

/** Utilità ritardi */
function isLate(k){
  const d = state.dates[k];
  if(!d) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const chosen = new Date(d); chosen.setHours(0,0,0,0);
  return chosen < today;
}
function updateStatsAndLate(){
  const arr = Object.values(state.points);
  const avg = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*20) : 0;
  const lateList = Object.keys(state.dates).filter(k=> isLate(k));
  document.getElementById("avgScore")?.replaceChildren(document.createTextNode(`${avg}%`));
  document.getElementById("lateCount")?.replaceChildren(document.createTextNode(String(lateList.length)));
  ["s1","s2","s3","s4","s5"].forEach(k=>{
    document.getElementById(`sheet-${k}`)?.classList.toggle("late", isLate(k));
  });
}

/** Utilità Note + parsing frasi */
function parsePoints(txt){
  const out = [];
  const re = /\((\d+)\)\s*([^]+?)(?=\s*\(\d+\)\s*|$)/g;
  let m;
  while((m = re.exec(txt))){ out.push(m[2].trim()); }
  return out;
}
function squaresSummaryColored(score){
  // 🟦 = scelto, ⬜ = non scelto
  const order = [0,1,3,5];
  return order.map(v => (v===score ? `🟦${v}` : `⬜${v}`)).join(" ");
}
function appendNote(k, text, score){
  const ta = document.querySelector(`#sheet-${k} textarea`);
  if(!ta) return;
  const line = `${squaresSummaryColored(score)} — ${text}`;
  ta.value = (ta.value ? ta.value.replace(/\s*$/,"")+"\n" : "") + line;
  state.notes[k] = ta.value;
  setJSON(storageKey("state"), state);
}
function nearestScore(mean){
  const choices = [0,1,3,5];
  let best = 0, bestDiff = Infinity;
  for (const c of choices){
    const d = Math.abs(mean - c);
    if (d < bestDiff) { bestDiff = d; best = c; }
  }
  return best;
}
function recalcFromDetailAndApply(k){
  const picks = Object.values(state.detail[k]||{});
  if (picks.length===0) return; // niente ancora
  const mean = picks.reduce((a,b)=>a+b,0) / picks.length;
  const newScore = nearestScore(mean);
  // applica alla scheda
  state.points[k] = newScore;
  setJSON(storageKey("state"), state);
  document.querySelectorAll(`#sheet-${k} .points button`).forEach(b=>{
    b.classList.toggle("active", Number(b.dataset.p)===newScore);
  });
  const sv = document.querySelector(`#sheet-${k} .s-value`);
  if (sv) sv.textContent = `Valore: ${newScore*20}%`;
  updateStatsAndLate();
}

/** HOME */
let chart;
function renderChart(){
  const ctx = document.getElementById("progressChart");
  if(!ctx) return;

  const vals = ["s1","s2","s3","s4","s5"].map(k=> (state.points[k]??0)*20 );
  const delayed = Object.keys(state.dates).filter(k=> isLate(k)).length;

  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type:"bar",
    data:{
      labels:["1S","2S","3S","4S","5S","Ritardi"],
      datasets:[{
        data:[...vals, delayed],
        backgroundColor:["#7c3aed","#ef4444","#f59e0b","#10b981","#2563eb","#ef4444"],
        borderWidth:0
      }]
    },
    options:{
      responsive:true,
      plugins:{
        legend:{display:false},
        tooltip:{
          enabled:true,
          callbacks:{
            label: (item)=>{
              // riga valore principale
              if (item.dataIndex===5) return "Ritardi: " + item.raw;
              return `${item.label}: ${item.raw}%`;
            },
            afterBody: (items)=>{
              // riassunto Note scelte nel popup per S1..S5
              const idx = items[0].dataIndex;
              if (idx<0 || idx>4) return;
              const key = ["s1","s2","s3","s4","s5"][idx];
              const det = state.detail[key]||{};
              const pts = parsePoints(INFO_TEXT[key]||"");
              const lines = Object.keys(det)
                .map(n=>Number(n))
                .sort((a,b)=>a-b)
                .slice(0,6) // massimo 6 righe per non esagerare
                .map(n=>{
                  const score = det[n];
                  const text  = pts[n] || "";
                  return `${n+1}) ${squaresSummaryColored(score)} ${text}`;
                });
              return lines.length ? lines : ["Nessuna nota selezionata"];
            }
          }
        }
      },
      scales:{
        y:{beginAtZero:true,max:100,grid:{display:false},ticks:{callback:v=>v+"%"}},
        x:{grid:{display:false},ticks:{maxRotation:0}}
      }
    }
  });

  // pulsanti “in ritardo”
  const late = [];
  ["s1","s2","s3","s4","s5"].forEach((k,i)=>{ if(isLate(k)) late.push({k, label:`${i+1}S in ritardo`}); });
  const box = document.getElementById("lateBtns");
  if (!box) return;
  box.innerHTML = "";
  late.forEach(({k,label})=>{
    const b = document.createElement("button");
    b.className = `late-btn ${k}`;
    b.style.borderColor = COLORS[k];
    b.textContent = label;
    b.addEventListener("click", ()=> { window.location.href = `checklist.html#sheet-${k}`; });
    box.appendChild(b);
  });
}
function setupHome(){
  refreshTitles();
  renderChart();
  document.getElementById("lockBtn")?.addEventListener("click", openPinDialog);
  document.getElementById("exportBtn")?.addEventListener("click", ()=>{
    const entered = prompt("Inserisci PIN per esportare");
    if (entered !== String(state.pin)) return;

    const payload = {
      area: CONFIG.AREA,
      channel: state.channel,
      date: new Date().toISOString(),
      points: state.points,
      notes: state.notes,
      dates: state.dates,
      detail: state.detail
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `SKF-5S-${CONFIG.AREA}-${state.channel}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

/** CHECKLIST */
function setupChecklist(){
  refreshTitles();
  document.getElementById("lockBtn")?.addEventListener("click", openPinDialog);

  const summary = document.getElementById("summaryBadges");
  ["s1","s2","s3","s4","s5"].forEach(k=>{
    const v = state.points[k] ?? 0;
    const el = document.createElement("button");
    el.className = `s-badge ${k}`;
    el.textContent = `${k.toUpperCase()} ${v*20}%`;
    el.addEventListener("click", ()=> {
      document.getElementById(`sheet-${k}`)?.scrollIntoView({behavior:"smooth",block:"start"});
    });
    summary.appendChild(el);
  });

  document.getElementById("toggleAll")?.addEventListener("click", ()=>{
    document.querySelectorAll(".s-details").forEach(det=> det.open = !det.open);
  });

  const wrap = document.getElementById("sheets");
  const defs = [
    {k:"s1", name:"1S — Selezionare",   color:COLORS.s1},
    {k:"s2", name:"2S — Sistemare",     color:COLORS.s2},
    {k:"s3", name:"3S — Splendere",     color:COLORS.s3},
    {k:"s4", name:"4S — Standardizzare",color:COLORS.s4},
    {k:"s5", name:"5S — Sostenere",     color:COLORS.s5},
  ];
  const todayStr = ()=> new Date().toISOString().slice(0,10);

  defs.forEach(({k,name,color})=>{
    const val = state.points[k] ?? 0;
    const late = isLate(k);

    const card = document.createElement("article");
    card.className = "sheet" + (late ? " late":"");
    card.id = `sheet-${k}`;
    card.innerHTML = `
      <div class="sheet-head">
        <span class="s-color" style="background:${color}"></span>
        <h3 class="s-title" style="color:${color}">${name}</h3>
        <span class="s-value">Valore: ${(val*20)}%</span>
        <button class="icon info" aria-label="Info" data-k="${k}">i</button>
        <button class="icon add" aria-label="Duplica">+</button>
      </div>

      <details class="s-details" open>
        <summary>▼ Dettagli</summary>

        <label class="field">
          <span>Responsabile / Operatore</span>
          <input placeholder="Inserisci il nome..." value="">
        </label>

        <label class="field">
          <span>Note</span>
          <textarea rows="3" placeholder="Note...">${state.notes[k]??""}</textarea>
        </label>

        <div class="field">
          <span>Data</span>
          <div class="row">
            <input type="date" value="${state.dates[k]??todayStr()}" data-date="${k}">
            <div class="points">
              ${[0,1,3,5].map(p=>`
                <button data-k="${k}" data-p="${p}" class="${val===p?'active':''}">${p}</button>
              `).join("")}
            </div>
            <button class="icon danger del">🗑</button>
          </div>
        </div>
      </details>
    `;
    wrap.appendChild(card);
  });

  // punteggi scheda (manuali)
  wrap.addEventListener("click",(e)=>{
    const btn = e.target.closest(".points button");
    if(!btn) return;
    const k = btn.dataset.k;
    const p = Number(btn.dataset.p);
    state.points[k] = p;
    setJSON(storageKey("state"), state);
    document.querySelectorAll(`.points button[data-k="${k}"]`).forEach(b=>b.classList.toggle("active", Number(b.dataset.p)===p));
    document.querySelector(`#sheet-${k} .s-value`).textContent = `Valore: ${p*20}%`;
    updateStatsAndLate();
  });

  // date → ritardo
  wrap.addEventListener("change",(e)=>{
    const inp = e.target.closest('input[type="date"][data-date]');
    if(!inp) return;
    const k = inp.dataset.date;
    state.dates[k] = inp.value;
    setJSON(storageKey("state"), state);
    updateStatsAndLate();
  });

  // elimina con PIN (reset scheda)
  wrap.addEventListener("click",(e)=>{
    const del = e.target.closest(".del");
    if(!del) return;
    const pin = prompt("Inserisci PIN per eliminare");
    if (pin !== String(state.pin)) return;
    const k = del.closest(".sheet").id.replace("sheet-","");
    state.points[k]=0; state.notes[k]=""; state.dates[k]=null; state.detail[k]={};
    setJSON(storageKey("state"), state);
    const s = del.closest(".sheet");
    s.querySelectorAll(".points button").forEach(b=>b.classList.remove("active"));
    s.querySelector(".s-value").textContent="Valore: 0%";
    s.querySelector('textarea').value="";
    s.querySelector('input[type="date"]').value=new Date().toISOString().slice(0,10);
    updateStatsAndLate();
  });

  // info popup
  wrap.addEventListener("click",(e)=>{
    const infoBtn = e.target.closest(".info");
    if(!infoBtn) return;
    openInfo(infoBtn.dataset.k);
  });

  // + duplicazione scheda (PIN)
  wrap.addEventListener("click",(e)=>{
    const add = e.target.closest(".add");
    if(!add) return;
    const pin = prompt("Inserisci PIN per duplicare");
    if (pin !== String(state.pin)) return;
    const card = add.closest(".sheet");
    const clone = card.cloneNode(true);
    const uid = Math.random().toString(36).slice(2,7);
    clone.id = card.id + "-x" + uid;
    clone.querySelectorAll("textarea").forEach(t=> t.value="");
    clone.querySelectorAll('input[type="date"]').forEach(d=> d.value=new Date().toISOString().slice(0,10));
    clone.querySelectorAll(".points button").forEach(b=> b.classList.remove("active"));
    clone.querySelector(".s-value").textContent="Valore: 0%";
    card.after(clone);
  });

  document.getElementById("infoCloseBtn")?.addEventListener("click", ()=> {
    document.getElementById("infoDialog").close();
  });

  updateStatsAndLate();
}

/** Popup “i” con punti interattivi + media automatica */
function openInfo(k){
  const dlg = document.getElementById("infoDialog");
  const title = document.getElementById("infoTitle");
  const cont = document.getElementById("infoContent");
  title.textContent = `${k.toUpperCase()} — Info`;
  cont.innerHTML = "";

  if (!state.detail[k]) state.detail[k] = {};
  const pts = parsePoints(INFO_TEXT[k] || "");

  const ol = document.createElement("ol");
  pts.forEach((txt, idx)=>{
    const li = document.createElement("li");
    const already = state.detail[k][idx] ?? null;
    const row = document.createElement("div");
    row.className = "pointline";
    row.innerHTML = `
      <div>${idx+1}. ${txt}</div>
      <div class="pick" data-k="${k}" data-idx="${idx}">
        ${[0,1,3,5].map(v=>`<button type="button" data-score="${v}" class="${already===v?'picked':''}">${v}</button>`).join("")}
      </div>
      <div class="note-mini">Seleziona un valore per aggiungere la riga in Note.</div>
    `;
    li.appendChild(row);
    ol.appendChild(li);
  });
  cont.appendChild(ol);

  cont.onclick = (e)=>{
    const btn = e.target.closest('.pick button');
    if(!btn) return;
    const pick = btn.closest('.pick');
    const score = Number(btn.dataset.score);
    const key = pick.dataset.k;
    const idx = Number(pick.dataset.idx);
    // evidenzia selezione
    pick.querySelectorAll('button').forEach(b=> b.classList.toggle('picked', b===btn));
    // salva scelta
    if (!state.detail[key]) state.detail[key]={};
    state.detail[key][idx] = score;
    setJSON(storageKey("state"), state);
    // aggiunge riga in Note (blu evidenziato via emoji)
    const text = parsePoints(INFO_TEXT[key]||"")[idx];
    appendNote(key, text, score);
    // calcola media e aggiorna scheda
    recalcFromDetailAndApply(key);
  };

  dlg.querySelector(".modal-box").style.borderTop = `6px solid ${COLORS[k]||'#0a57d5'}`;
  dlg.showModal();
}

/** Router */
document.addEventListener("DOMContentLoaded", ()=>{
  refreshTitles();
  if (document.body.dataset.page==="home") setupHome();
  if (document.body.dataset.page==="checklist") setupChecklist();
});
