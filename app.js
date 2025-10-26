// SKF 5S Supervisor — build 2.3.12 (fix import note)
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY = 'skf5s:pin';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const store = {
    load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
            catch(e){ return []; } },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // --- parser note robusto
  function parseNotes(notes, date) {
    const list = [];
    if (!notes) return list;

    // caso 1: notes come array
    if (Array.isArray(notes)) {
      for (const n of notes) {
        list.push({
          s: n.s || n.S || n.type || '',
          text: n.text || n.note || '',
          date: n.date || date
        });
      }
    }
    // caso 2: notes come oggetto {s1:"..", s2:".."}
    else if (typeof notes === 'object') {
      for (const k of Object.keys(notes)) {
        const val = notes[k];
        if (typeof val === 'string' && val.trim()) {
          for (const line of val.split(/\n+/)) {
            const t = line.trim();
            if (t) list.push({ s:k, text:t, date });
          }
        }
      }
    }
    return list;
  }

  function parseRec(obj){
    const rec = {
      area: obj.area || '',
      channel: obj.channel || obj.CH || obj.ch || '',
      date: obj.date || obj.timestamp || new Date().toISOString(),
      points: obj.points || obj.kpi || {},
      notes: []
    };
    rec.points = {
      s1: Number(rec.points.s1 || rec.points.S1 || rec.points['1S'] || 0),
      s2: Number(rec.points.s2 || rec.points.S2 || rec.points['2S'] || 0),
      s3: Number(rec.points.s3 || rec.points.S3 || rec.points['3S'] || 0),
      s4: Number(rec.points.s4 || rec.points.S4 || rec.points['4S'] || 0),
      s5: Number(rec.points.s5 || rec.points.S5 || rec.points['5S'] || 0)
    };
    rec.notes = parseNotes(obj.notes, rec.date);
    return rec;
  }

  async function handleImport(files){
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));
    for (const f of files){
      try{
        const txt = await f.text();
        const rec = parseRec(JSON.parse(txt));
        if (!rec.channel) throw new Error('CH mancante');
        byKey.set(rec.area + '|' + rec.channel + '|' + rec.date, rec);
      }catch(e){
        alert('Errore file: ' + f.name);
      }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=> new Date(a.date)-new Date(b.date));
    store.save(merged);
    render();
  }

  function renderNotes(){
    const box = $('#notes-list'); if(!box) return;
    const rows = [];
    for (const r of store.load()){
      for (const n of r.notes){
        rows.push({ ch:r.channel, area:r.area, s:n.s, text:n.text, date:n.date });
      }
    }
    box.innerHTML='';
    if (!rows.length){
      box.innerHTML = '<div class="muted">Nessuna nota trovata.</div>';
      return;
    }
    for (const n of rows){
      const sNum = (n.s||'').match(/[1-5]/)?.[0] || '1';
      const el = document.createElement('div');
      el.className='note';
      el.innerHTML=`
        <div><b>${n.ch}</b> • <span class="pill s${sNum}">S${sNum}</span> ${n.area||''}</div>
        <div class="muted">${n.date||''}</div>
        <div>${n.text}</div>`;
      box.appendChild(el);
    }
  }

  function exportAll(){
    const blob = new Blob([JSON.stringify(store.load(),null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='SKF-5S-supervisor-archive.json';
    a.click();
  }

  function initCommon(){
    $('#btn-import')?.addEventListener('click',()=>$('#import-input')?.click());
    $('#import-input')?.addEventListener('change',(e)=>handleImport(e.target.files));
    $('#btn-notes')?.addEventListener('click',renderNotes);
    $('#btn-export')?.addEventListener('click',exportAll);
  }

  function render(){ renderNotes(); }
  window.addEventListener('DOMContentLoaded',()=>{initCommon();render();});
})();
