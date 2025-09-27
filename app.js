
// Simple in-memory + localStorage store
const STORE_KEY = 'skf5s_supervisor_v1';
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function loadStore(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {records:[], notes:[]}; }
  catch(e){ return {records:[], notes:[]}; }
}
function saveStore(data){ localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
function clearStore(){ localStorage.removeItem(STORE_KEY); }

// Read many JSON files (schema: {area, channel, date, points:{s1..s5}, notes:[{s, text, date}], late:number})
async function pickAndImport(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.multiple = true;
  input.click();
  return new Promise((resolve)=>{
    input.onchange = async () => {
      const files = Array.from(input.files||[]);
      if(!files.length){ resolve({added:0}); return; }
      const store = loadStore();
      let added = 0;
      for(const f of files){
        try{
          const txt = await f.text();
          const data = JSON.parse(txt);
          // allow either single object or array
          const arr = Array.isArray(data) ? data : [data];
          for(const rec of arr){
            if(!rec || !rec.channel) continue;
            store.records.push(rec);
            if(Array.isArray(rec.notes)){
              rec.notes.forEach(n => store.notes.push({...n, channel: rec.channel, area: rec.area || ''}));
            }
            added++;
          }
        }catch(e){ console.warn('file parse error', f.name, e); }
      }
      saveStore(store);
      resolve({added, files: files.map(f=>f.name)});
    };
  });
}

// Aggregations
function groupByChannel(records){
  const map = new Map();
  for(const r of records){
    const key = r.channel;
    if(!map.has(key)) map.set(key, {channel:key, area:r.area||'', last:r.date||'', points:{s1:0,s2:0,s3:0,s4:0,s5:0}, late:0, count:0});
    const g = map.get(key);
    g.points.s1 = r.points?.s1 ?? g.points.s1;
    g.points.s2 = r.points?.s2 ?? g.points.s2;
    g.points.s3 = r.points?.s3 ?? g.points.s3;
    g.points.s4 = r.points?.s4 ?? g.points.s4;
    g.points.s5 = r.points?.s5 ?? g.points.s5;
    g.late = (r.late ?? 0);
    g.last = r.date || g.last;
    g.area = r.area || g.area;
    g.count++;
  }
  return Array.from(map.values()).sort((a,b)=>a.channel.localeCompare(b.channel));
}

function overallFrom(groups){
  const avg = {s1:0,s2:0,s3:0,s4:0,s5:0};
  if(!groups.length) return avg;
  for(const g of groups){
    avg.s1 += g.points.s1||0;
    avg.s2 += g.points.s2||0;
    avg.s3 += g.points.s3||0;
    avg.s4 += g.points.s4||0;
    avg.s5 += g.points.s5||0;
  }
  for(const k of Object.keys(avg)) avg[k] = Math.round(avg[k]/groups.length);
  return avg;
}

// Charts helper
function renderBar(el, data){
  if(!window.Chart){ console.warn('Chart.js missing'); return; }
  const ctx = el.getContext('2d');
  new Chart(ctx, {
    type:'bar',
    data:{
      labels:['1S','2S','3S','4S','5S','Ritardi'],
      datasets:[{
        label:'%',
        data:[data.s1||0,data.s2||0,data.s3||0,data.s4||0,data.s5||0,data.late||0]
      }]
    },
    options:{responsive:true, plugins:{legend:{display:false}}, scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%'}}}}
  });
}

// Index page controller
async function bootIndex(){
  const importBtn = $('#importBtn');
  const cardsWrap = $('#cardsWrap');
  const overallCanvas = $('#overallChart');
  importBtn?.addEventListener('click', async ()=>{
    const res = await pickAndImport();
    alert(`Import: ${res.added} record caricati`);
    drawIndex();
  });
  drawIndex();

  function drawIndex(){
    const store = loadStore();
    const groups = groupByChannel(store.records);
    const ov = overallFrom(groups);
    if(overallCanvas){
      const ctx = overallCanvas.getContext('2d');
      ctx.clearRect(0,0,overallCanvas.width, overallCanvas.height);
      renderBar(overallCanvas, {...ov, late: groups.reduce((a,g)=>a+(g.late||0),0)});
    }
    cardsWrap.innerHTML = '';
    for(const g of groups){
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="row" style="justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <span class="badge">${g.area || '-'}</span>
            <strong>${g.channel}</strong>
            <span class="small">Ultimo: ${g.last||'-'}</span>
          </div>
          <div class="row" style="gap:8px">
            <a class="btn" href="checklist.html?ch=${encodeURIComponent(g.channel)}">Apri in checklist</a>
          </div>
        </div>
        <hr class="sep"/>
        <canvas class="chart" height="220"></canvas>
      `;
      cardsWrap.appendChild(card);
      const canvas = card.querySelector('canvas');
      renderBar(canvas, {...g.points, late:g.late||0});
    }
  }
}

// Checklist page
function bootChecklist(){
  // read channel param
  const usp = new URLSearchParams(location.search);
  const ch = usp.get('ch');
  $('#chTitle').textContent = ch ? ch : 'Tutte le linee';

  const lockBtn = $('#lockBtn');
  let locked = false;
  lockBtn.addEventListener('click', ()=>{
    locked = !locked;
    lockBtn.textContent = locked ? 'Sblocca' : 'Blocca';
    $$('.editable').forEach(el => el.disabled = locked);
  });

  const list = $('#sList');
  const sDefs = [
    {key:'s1', title:'1S — Selezionare', cls:'s1'},
    {key:'s2', title:'2S — Sistemare', cls:'s2'},
    {key:'s3', title:'3S — Splendere', cls:'s3'},
    {key:'s4', title:'4S — Standardizzare', cls:'s4'},
    {key:'s5', title:'5S — Sostenere', cls:'s5'},
  ];

  function render(){
    const store = loadStore();
    list.innerHTML = '';
    const records = ch ? store.records.filter(r=>r.channel===ch) : store.records;
    const latest = {};
    for(const k of ['s1','s2','s3','s4','s5']) latest[k]=0;
    if(records.length){
      const last = records[records.length-1];
      Object.assign(latest, last.points||{});
    }
    for(const def of sDefs){
      const val = latest[def.key]||0;
      const card = document.createElement('div');
      card.className = `card sCard ${def.cls}`;
      card.innerHTML = `
        <div class="row" style="justify-content:space-between">
          <div class="sTitle">${def.title}</div>
          <div class="row" style="gap:8px">
            <span class="badge">Valore: ${val}%</span>
            <button class="btn ghost" aria-expanded="false">+</button>
          </div>
        </div>
        <div class="body" hidden>
          <div class="toggle">
            <label>Note</label>
            <textarea class="editable" rows="3" style="flex:1" placeholder="Scrivi..."></textarea>
            <button class="btn saveBtn">Salva nota</button>
          </div>
        </div>
      `;
      const plus = card.querySelector('button[aria-expanded]');
      plus.addEventListener('click', ()=>{
        const open = plus.getAttribute('aria-expanded')==='true';
        plus.setAttribute('aria-expanded', String(!open));
        plus.textContent = open ? '+' : '–';
        card.querySelector('.body').hidden = open;
      });
      card.querySelector('.saveBtn').addEventListener('click', ()=>{
        if(locked){ alert('Sbloccati per modificare'); return; }
        const txt = card.querySelector('textarea').value.trim();
        if(!txt) return;
        const store = loadStore();
        store.notes.push({channel: ch||'Tutte', area:'', s:def.key, text:txt, date:new Date().toISOString()});
        saveStore(store);
        alert('Nota salvata');
        card.querySelector('textarea').value='';
      });
      list.appendChild(card);
    }
  }
  render();

  $('#importBtn2').addEventListener('click', async ()=>{
    const res = await pickAndImport();
    alert(`Import: ${res.added} record`);
    render();
  });
}

// Notes page
function bootNotes(){
  const wrap = $('#notesWrap');
  const store = loadStore();
  // group by channel then by S
  const byCh = {};
  for(const n of store.notes){
    byCh[n.channel] = byCh[n.channel] || {channel:n.channel, byS:{}};
    const s = n.s || 's1';
    byCh[n.channel].byS[s] = byCh[n.channel].byS[s] || [];
    byCh[n.channel].byS[s].push(n);
  }
  wrap.innerHTML = '';
  const order = ['s1','s2','s3','s4','s5'];
  for(const ch of Object.keys(byCh)){
    const sect = document.createElement('div');
    sect.className='card';
    sect.innerHTML = `<div class="sTitle">${ch}</div>`;
    for(const key of order){
      const arr = byCh[ch].byS[key]||[];
      if(!arr.length) continue;
      const box = document.createElement('div');
      box.className='card';
      box.style.margin='8px 0';
      const titleMap = {s1:'1S',s2:'2S',s3:'3S',s4:'4S',s5:'5S'};
      box.innerHTML = `<div class="sTitle">${titleMap[key]}</div>
        <ul>${arr.map(n=>`<li><span class="small">${new Date(n.date).toLocaleString()}</span> — ${n.text}</li>`).join('')}</ul>`;
      sect.appendChild(box);
    }
    wrap.appendChild(sect);
  }
}

// Router
document.addEventListener('DOMContentLoaded', ()=>{
  if(document.body.dataset.page==='index') bootIndex();
  if(document.body.dataset.page==='checklist') bootChecklist();
  if(document.body.dataset.page==='notes') bootNotes();
});
