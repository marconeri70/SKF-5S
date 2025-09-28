
// SKF 5S Supervisor — single JS for all pages
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Local store
  const store = {
    load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } },
    save(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // Import (multiple files)
  async function handleImport(files){
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area+'|'+r.channel+'|'+(r.date||''), r]));
    let ok=0, ko=0;
    for (const f of files) {
      try {
        const rec = JSON.parse(await f.text());
        if (rec && rec.area && rec.channel && rec.points) {
          const k = rec.area+'|'+rec.channel+'|'+(rec.date||'');
          byKey.set(k, rec); ok++;
        } else { ko++; }
      } catch { ko++; }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=> new Date(a.date||0)-new Date(b.date||0));
    store.save(merged);
    alert(`Import completato: ${ok} file. Errori: ${ko}`);
    render();
  }

  // Simple bars without libs
  function renderBars(el, values, colors){
    el.innerHTML='';
    const labs = ['1S','2S','3S','4S','5S'];
    const max = Math.max(100, ...values);
    values.forEach((v,i)=>{
      const b = document.createElement('div');
      b.className='bar';
      b.dataset.v = Math.round(v||0);
      const iel = document.createElement('i');
      iel.style.background = colors[i];
      iel.style.height = (v/max*100)+'%';
      b.appendChild(iel);
      const s = document.createElement('span'); s.textContent=labs[i];
      b.appendChild(s);
      el.appendChild(b);
    });
  }

  // --------- Home (index.html)
  function renderHome(){
    const root = $('#boards'); if (!root) return;
    const chips = $('#chip-strip');
    const data = store.load();

    root.innerHTML=''; chips.innerHTML='';

    // group by ch and pick last snapshot
    const byCh = new Map();
    for (const r of data){
      const k = r.channel || 'CH ?';
      const arr = byCh.get(k) || []; arr.push(r); byCh.set(k,arr);
    }

    for (const [ch, arr] of byCh){
      const last = arr.sort((a,b)=> new Date(a.date||0)-new Date(b.date||0)).slice(-1)[0];
      const vals = [last?.points?.s1||0,last?.points?.s2||0,last?.points?.s3||0,last?.points?.s4||0,last?.points?.s5||0];

      const card = document.createElement('div');
      card.className='board';
      card.innerHTML = `
        <h3>${ch} <span class="small muted">${last?.area||''}</span></h3>
        <div class="chart" id="c-${CSS.escape(ch)}"></div>
        <div class="small muted" style="margin-top:.35rem">Ultimo: ${last?.date||'-'}</div>
        <div class="toolbar" style="margin-top:.5rem">
          <button class="btn" onclick="location.href='checklist.html#${encodeURIComponent(ch)}'">Apri in checklist</button>
          <button class="btn" onclick="window.print()">Stampa PDF</button>
        </div>`;
      root.appendChild(card);
      renderBars($('#c-'+CSS.escape(ch)), vals, ['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)']);

      const chip = document.createElement('button');
      chip.className='chip'; chip.textContent = ch;
      chip.onclick = ()=> location.href='checklist.html#'+encodeURIComponent(ch);
      chips.appendChild(chip);
    }
  }

  // --------- Checklist (checklist.html)
  function renderChecklist(){
    const wrap = $('#cards'); if (!wrap) return;
    const data = store.load(); wrap.innerHTML='';

    // filter hash ch?
    const filterCh = decodeURIComponent(location.hash.slice(1)||'');

    const byCh = new Map();
    for (const r of data){
      const k = r.channel || 'CH ?';
      if (filterCh && k !== filterCh) continue;
      const arr = byCh.get(k) || []; arr.push(r); byCh.set(k, arr);
    }

    for (const [ch, arr] of byCh){
      const last = arr.sort((a,b)=> new Date(a.date||0)-new Date(b.date||0)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((p.s1+p.s2+p.s3+p.s4+p.s5)/5);

      const card = document.createElement('div');
      card.className='card-line';
      const nid = 'n-'+Math.random().toString(36).slice(2,8);
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${ch}</div>
            <div class="muted small">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${p.s1}%</span>
            <span class="pill s2">S2 ${p.s2}%</span>
            <span class="pill s3">S3 ${p.s3}%</span>
            <span class="pill s4">S4 ${p.s4}%</span>
            <span class="pill s5">S5 ${p.s5}%</span>
          </div>
          <div><span class="badge">Voto medio ${avg}%</span></div>
          <div><button class="btn" onclick="window.print()">Stampa PDF</button></div>
        </div>
        <details style="margin-top:.5rem">
          <summary class="small">Mostra note</summary>
          <div id="${nid}" class="small muted">Nessuna nota per questo CH.</div>
        </details>`;
      wrap.appendChild(card);

      const notesTarget = $('#'+nid);
      const notes = arr.flatMap(r => Array.isArray(r.notes)? r.notes.map(n=>({date:n.date||r.date, s:n.s||n.S, text:n.text||n.note||''})) : [])
                        .sort((a,b)=> new Date(b.date)-new Date(a.date));
      if (notes.length){
        notesTarget.innerHTML = notes.map(n => `<div class="note"><div class="small muted">${n.date} • <span class="pill s${n.s?.[0]||''}">${n.s||''}</span></div><div>${(n.text||'').replaceAll('\n','<br>')}</div></div>`).join('');
      }
    }
  }

  // --------- Notes (notes.html)
  function renderNotes(){
    const list = $('#notes-list'); if (!list) return;
    list.innerHTML='';
    const data = store.load();
    const rows = [];
    for (const r of data){
      const nn = Array.isArray(r.notes)? r.notes : [];
      for (const n of nn){
        rows.push({ ch: r.channel, area:r.area, date:n.date||r.date, s:n.s||n.S, text:n.text||n.note||'' });
      }
    }
    if (!rows.length){ list.innerHTML='<div class="muted">Nessuna nota importata.</div>'; return; }
    rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
    for (const n of rows){
      const el = document.createElement('div');
      el.className='note';
      el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
        <div><strong>${n.ch}</strong> • ${n.area} • <span class="pill s${n.s?.[0]||''}">${n.s||''}</span></div>
        <div class="muted small">${n.date}</div></div>
        <div style="margin-top:.35rem">${(n.text||'').replaceAll('\n','<br>')}</div>`;
      list.appendChild(el);
    }
  }

  // Export with PIN 1234 (demo)
  function exportWithPin(){
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin!=='1234'){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(),null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // Lock icon (both pages)
  function initLock(){
    const el = $('#btn-lock'); if (!el) return;
    let locked = sessionStorage.getItem('sv:locked')==='1';
    const paint = ()=> el.textContent = locked ? '🔓' : '🔒';
    el.onclick = ()=>{ locked = !locked; sessionStorage.setItem('sv:locked',locked?'1':'0'); paint(); };
    paint();
  }

  function initCommon(){
    const file = $('#import-input');
    if (file){ file.onchange = () => handleImport(file.files); }
    const exp = $('#btn-export');
    if (exp){ exp.onclick = exportWithPin; }
  }

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  window.addEventListener('DOMContentLoaded', () => {
    initCommon(); initLock(); render();
    if ('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
  });
})();
