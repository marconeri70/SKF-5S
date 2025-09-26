
/* SKF 5S — Supervisor core (v2.1.1) */
const LS_KEY='skf5s_supervisor_archive_v1';

/* ---------- Storage helpers ---------- */
function loadArchive(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch(e){ console.warn('bad storage',e); return []; }
}
function saveArchive(data){
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}
function upsertRecord(rec){
  // normalize
  const n = {
    area: rec.area || rec.Area || rec.line || 'Area',
    channel: rec.channel || rec.Channel || rec.ch || 'CH',
    date: rec.date || rec.Date || new Date().toISOString().slice(0,10),
    points: rec.points || rec.scores || {s1:0,s2:0,s3:0,s4:0,s5:0},
    notes: rec.notes || [],
    late: rec.late || rec.delays || {}
  };
  // ensure numbers 0..100
  ['s1','s2','s3','s4','s5'].forEach(k=>{
    let v = n.points[k];
    if(Array.isArray(v)) v = v.reduce((a,b)=>a+(+b||0),0)/Math.max(1,v.length);
    n.points[k] = Math.max(0, Math.min(100, Math.round(+v||0)));
  });
  const arch = loadArchive();
  arch.push(n); // append (non distruttivo)
  saveArchive(arch);
  return n;
}
function importFiles(fileList, onDone){
  if(!fileList || !fileList.length){ alert('Nessun file selezionato'); return; }
  const files = Array.from(fileList);
  let imported = 0, total=files.length;
  let done=0;
  files.forEach(f=>{
    const fr = new FileReader();
    fr.onload = () => {
      try{
        const json = JSON.parse(fr.result);
        if(Array.isArray(json)){ json.forEach(x=>{ upsertRecord(x); imported++; }); }
        else { upsertRecord(json); imported++; }
      }catch(e){ console.error('JSON error', e); }
      if(++done===total){ onDone && onDone(imported,total); }
    };
    fr.onerror = () => { console.error('read error', f.name); if(++done===total){ onDone && onDone(imported,total); } };
    fr.readAsText(f);
  });
}

/* ---------- UI helpers ---------- */
function byId(id){ return document.getElementById(id); }
function formatPct(n){ return (Math.round(n)||0) + '%'; }
function groupByChannel(records){
  const map = new Map();
  records.forEach(r=>{
    const key = (r.area||'')+'—'+(r.channel||'');
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  return map;
}
function lastByDate(arr){
  return arr.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
}

/* ---------- Charts ---------- */
function ensureChartJs(){
  return new Promise((resolve)=>{
    if(window.Chart){ resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}
function buildBar(canvas, points){
  const data = [points.s1,points.s2,points.s3,points.s4,points.s5];
  const labels = ['1S','2S','3S','4S','5S'];
  const colors = ['#7e57c2','#ef5350','#ffa000','#43a047','#1e88e5'];
  const ctx = canvas.getContext('2d');
  return new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ data, backgroundColor: colors, borderRadius:8 }]},
    options:{ responsive:true, plugins:{legend:{display:false}, tooltip:{enabled:true}}, scales:{y:{beginAtZero:true,max:100}}}
  });
}

/* ---------- Index page ---------- */
async function initIndex(){
  // wire buttons
  const fileInput = byId('importFiles');
  const importBtn = byId('importBtn');
  importBtn?.addEventListener('click', ()=> fileInput.click());
  fileInput?.addEventListener('change', (e)=>{
    importFiles(e.target.files, (ok,total)=>{
      alert(`Import completato: ${ok}/${total}`);
      renderIndex();
    });
  });
  renderIndex();
}
async function renderIndex(){
  await ensureChartJs();
  const records = loadArchive();
  const wrap = byId('chWrap');
  wrap.innerHTML='';
  const g = groupByChannel(records);
  if(g.size===0){
    wrap.innerHTML = '<div class="small">Importa i file JSON dei CH per vedere i grafici qui.</div>';
    return;
  }
  g.forEach((arr, key)=>{
    const last = lastByDate(arr);
    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong>${last.channel}</strong>
        <div class="chips">
          <button class="btn secondary" data-open="${last.channel}">Apri in checklist</button>
          <button class="btn secondary" data-print="${last.channel}">Stampa PDF</button>
        </div>
      </div>
      <div class="chartbox"><canvas height="120"></canvas></div>
      <div class="small">Area: ${last.area} • Ultimo aggiornamento: ${last.date}</div>
    `;
    wrap.appendChild(card);
    buildBar(card.querySelector('canvas'), last.points);
    card.querySelector('[data-open]')?.addEventListener('click',()=>{
      location.href = 'checklist.html?ch=' + encodeURIComponent(last.channel);
    });
    card.querySelector('[data-print]')?.addEventListener('click',()=>{
      window.print();
    });
  });
}

/* ---------- Checklist (schede) page ---------- */
async function initChecklist(){
  // header: show channel if provided
  const params = new URLSearchParams(location.search);
  const ch = params.get('ch');
  const box = byId('cards');
  const records = loadArchive();
  const g = groupByChannel(records);
  box.innerHTML='';
  let any = false;
  g.forEach((arr,key)=>{
    const last = lastByDate(arr);
    if(ch && last.channel!==ch) return;
    any = true;
    const c = document.createElement('div');
    c.className='card';
    c.innerHTML = `
      <h2 style="margin-bottom:6px">${last.channel} — <span class="small">${last.area}</span></h2>
      <div class="kpi">
        <div class="box"><div class="small">1S</div><div style="font-weight:800">${formatPct(last.points.s1)}</div></div>
        <div class="box"><div class="small">2S</div><div style="font-weight:800">${formatPct(last.points.s2)}</div></div>
        <div class="box"><div class="small">3S</div><div style="font-weight:800">${formatPct(last.points.s3)}</div></div>
        <div class="box"><div class="small">4S</div><div style="font-weight:800">${formatPct(last.points.s4)}</div></div>
        <div class="box"><div class="small">5S</div><div style="font-weight:800">${formatPct(last.points.s5)}</div></div>
      </div>
      <div class="chartbox"><canvas height="120"></canvas></div>
    `;
    box.appendChild(c);
    buildBar(c.querySelector('canvas'), last.points);
  });
  if(!any) box.innerHTML = '<div class="small">Nessuna scheda: importa prima i file dalla home.</div>';
}

/* ---------- Notes page ---------- */
function initNotes(){
  const records = loadArchive();
  const tbody = byId('notesBody');
  tbody.innerHTML='';
  const rows = [];
  records.forEach(r=>{
    const items = Array.isArray(r.notes) ? r.notes : [];
    items.forEach(n=>{
      rows.push({
        area: r.area, ch: r.channel, s: n.s || n.S || n.section || '?S',
        date: n.date || r.date || '',
        text: n.text || n.note || ''
      });
    });
  });
  rows.sort((a,b)=> new Date(b.date) - new Date(a.date));
  if(rows.length===0){
    tbody.innerHTML = '<tr><td colspan="5" class="small">Nessuna nota trovata nei file importati.</td></tr>';
    return;
  }
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.date||''}</td><td>${r.ch}</td><td>${r.s}</td><td>${r.area}</td><td>${r.text}</td>`;
    tbody.appendChild(tr);
  });
}

/* ---------- Service worker ---------- */
function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('SW failed',e));
  }
}

/* ---------- Boot by page ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  registerSW();
  if(document.body.dataset.page==='index') initIndex();
  if(document.body.dataset.page==='checklist') initChecklist();
  if(document.body.dataset.page==='notes') initNotes();
});
