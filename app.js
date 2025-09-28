
(() => {
  const LS_KEY = 'skf5s_archive_v2';
  const PIN = '4321';
  const $ = (sel, ctx=document)=>ctx.querySelector(sel);
  function readArchive(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
  function saveArchive(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }
  function byKey(r){ return `${(r.area||'').trim()}|${(r.channel||'').trim()}|${r.date||''}`; }
  function unify(records){
    const m = new Map();
    for(const r of records){
      if(!r || typeof r!=='object') continue;
      const p = r.points || r.Punti || r.scores || {};
      const rec = {
        area: r.area || r.Area || r.linea || '',
        channel: r.channel || r.CH || r.channelName || r.name || '',
        date: r.date || r.data || r.updated || '',
        points: {
          s1: Number((p.s1 ?? p.S1 ?? p['1'] ?? 0)) || 0,
          s2: Number((p.s2 ?? p.S2 ?? p['2'] ?? 0)) || 0,
          s3: Number((p.s3 ?? p.S3 ?? p['3'] ?? 0)) || 0,
          s4: Number((p.s4 ?? p.S4 ?? p['4'] ?? 0)) || 0,
          s5: Number((p.s5 ?? p.S5 ?? p['5'] ?? 0)) || 0
        },
        notes: r.notes || r.note || [],
        delays: r.delays || r.late || r.ritardi || 0
      };
      m.set(byKey(rec), rec);
    }
    return Array.from(m.values());
  }
  function handleImport(files){
    if(!files?.length){ alert('Nessun file selezionato'); return; }
    const readers = Array.from(files).map(f => f.text().then(t => JSON.parse(t)));
    Promise.all(readers).then(parts => {
      const incoming = unify(parts.flatMap(x => Array.isArray(x) ? x : [x]));
      const base = readArchive();
      const map = new Map(base.map(r => [byKey(r), r]));
      for(const r of incoming){ map.set(byKey(r), r); }
      const merged = Array.from(map.values());
      saveArchive(merged);
      alert(`Import completato: ${incoming.length} record. Totale archivio: ${merged.length}.`);
      renderAll();
    }).catch(err => alert('Errore import: '+err.message));
  }
  function handleExport(){
    const pin = prompt('Inserisci PIN per esportare:');
    if(pin !== PIN){ alert('PIN errato'); return; }
    const data = readArchive();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `SKF-5S-archive-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  }
  function avgPoints(p){ return Math.round((+p.s1 + +p.s2 + +p.s3 + +p.s4 + +p.s5)/5); }
  function makeBar(cls, v){
    const h = Math.max(2, Math.min(100, Number(v)||0));
    return `<div class="bar ${cls}" style="height:${h}%"><span>${h}%</span></div>`;
  }
  function renderIndex(){
    const data = readArchive();
    const latestByCH = {};
    for(const r of data){
      const key = `${r.area}::${r.channel}`;
      if(!latestByCH[key] || (r.date||'') > (latestByCH[key].date||'')) latestByCH[key]=r;
    }
    const rows = Object.entries(latestByCH).map(([, r]) => r);
    $('#kpiLines').textContent = rows.length;
    const avg = rows.length? Math.round(rows.reduce((s,x)=>s+avgPoints(x.points),0)/rows.length):0;
    $('#kpiAvg').textContent = avg + '%';
    const late = rows.reduce((s,x)=> s + Number(x.delays||0), 0);
    $('#kpiLate').textContent = late;
    const chips = rows.map(r => `<button class="flat small" data-open="${encodeURIComponent(r.area+'|'+r.channel)}">${r.channel}</button>`).join(' ');
    const chipsBox = document.getElementById('chips'); if(chipsBox){ chipsBox.innerHTML = chips || '<span class="muted">Nessuna linea importata</span>'; chipsBox.onclick = (e)=>{
      const id = e.target?.dataset?.open; if(!id) return; sessionStorage.setItem('skf5s_current', decodeURIComponent(id)); location.href = 'checklist.html';
    };}
    const wrap = document.getElementById('channels'); if(wrap){ wrap.innerHTML=''; for(const r of rows){
      const card = document.createElement('div');
      card.className='ch-card';
      card.innerHTML = `
        <div class="head">
          <div><strong>${r.channel}</strong> <span class="tags">${r.area}</span></div>
          <div class="row-actions">
            <button class="ghost small" data-open="${encodeURIComponent(r.area+'|'+r.channel)}">Apri in checklist</button>
          </div>
        </div>
        <div class="mini-bars">
          ${makeBar('b1',r.points.s1)}
          ${makeBar('b2',r.points.s2)}
          ${makeBar('b3',r.points.s3)}
          ${makeBar('b4',r.points.s4)}
          ${makeBar('b5',r.points.s5)}
        </div>`;
      wrap.appendChild(card);
      card.addEventListener('click', (e)=>{
        if(e.target.closest('[data-open]')){
          sessionStorage.setItem('skf5s_current', decodeURIComponent(e.target.closest('[data-open]').dataset.open));
          location.href = 'checklist.html';
        }
      });
    }}
  }
  function renderChecklist(){
    const id = sessionStorage.getItem('skf5s_current');
    const data = readArchive();
    const byCH = {};
    for(const r of data){ const k = `${r.area}|${r.channel}`; (byCH[k] ||= []).push(r); }
    const entries = id? byCH[id] : (Object.values(byCH)[0] || []);
    const latest = entries.sort((a,b)=> (b.date||'').localeCompare(a.date||''))[0];
    const cards = document.getElementById('cards');
    if(!cards) return;
    cards.innerHTML = '';
    if(!latest){ cards.innerHTML = '<p class="muted">Nessun dato importato per questa vista.</p>'; return; }
    const header = document.createElement('div');
    header.className='row-actions'; header.style.marginBottom='12px';
    header.innerHTML = `<span class="badge s5">Area: ${latest.area}</span> <span class="badge s1">CH: ${latest.channel}</span> <span class="badge s4">Ultimo: ${latest.date||'-'}</span>`;
    cards.appendChild(header);
    const S = [
      {k:'s1', name:'1S — Selezionare', cls:'s1'},
      {k:'s2', name:'2S — Sistemare', cls:'s2'},
      {k:'s3', name:'3S — Splendere', cls:'s3'},
      {k:'s4', name:'4S — Standardizzare', cls:'s4'},
      {k:'s5', name:'5S — Sostenere', cls:'s5'},
    ];
    for(const s of S){
      const v = latest.points[s.k] || 0;
      const notes = (latest.notes||[]).filter(n => (n.s||'').toLowerCase().includes(s.k));
      const box = document.createElement('div');
      box.className='card'; box.style.marginBottom='12px';
      box.innerHTML = `
        <div class="row" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <strong>${s.name}</strong>
          <span class="badge ${s.cls}">${v}%</span>
        </div>
        <div class="mini-bars">
          ${makeBar('b1', latest.points.s1)}
          ${makeBar('b2', latest.points.s2)}
          ${makeBar('b3', latest.points.s3)}
          ${makeBar('b4', latest.points.s4)}
          ${makeBar('b5', latest.points.s5)}
        </div>
        <div style="margin-top:8px">
          <details><summary>Note (${notes.length})</summary>
            ${(notes.length? notes.map(n=>`<div style="margin:.4rem 0"><span class="chip ${s.cls}">${s.name.split(' — ')[0]}</span> • <em>${n.date||'-'}</em> — ${String(n.text||n.note||'').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}</div>`).join('') : '<em class="muted">Nessuna nota</em>')}
          </details>
        </div>`;
      cards.appendChild(box);
    }
    const btn = document.getElementById('btnLock');
    if(btn){
      const apply = (on)=> { btn.textContent = on? 'Sbloccato' : 'Blocca'; btn.classList.toggle('on', on); };
      btn.addEventListener('click', ()=> apply(!btn.classList.contains('on')));
      apply(false);
    }
  }
  function renderNotes(){
    const data = readArchive(); const all = [];
    for(const r of data){ for(const n of (r.notes||[])){ all.push({area:r.area, channel:r.channel, s:n.s||'S?', date:n.date||'', text:n.text||n.note||''}); } }
    all.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    const tbl = document.getElementById('tblNotes'); if(!tbl) return;
    if(!all.length){ tbl.innerHTML = '<tr><td>Nessuna nota importata.</td></tr>'; return; }
    tbl.innerHTML = all.map(n=>`
      <tr>
        <td class="chip ${n.s.toLowerCase()}">${n.s}</td>
        <td><strong>${n.channel}</strong> <span class="tags">${n.area}</span></td>
        <td><em>${n.date||'-'}</em></td>
        <td>${String(n.text).replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}</td>
      </tr>`).join('');
  }
  function renderAll(){ if(document.getElementById('channels')) renderIndex(); if(document.getElementById('cards')) renderChecklist(); if(document.getElementById('tblNotes')) renderNotes(); }

  function wire(){
    const fi = document.getElementById('file-import'); if(fi) fi.addEventListener('change', e=> handleImport(e.target.files));
    const btnExp = document.getElementById('btnExport'); if(btnExp) btnExp.addEventListener('click', handleExport);
    renderAll();
    if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
  }
  document.addEventListener('DOMContentLoaded', wire);
})();
