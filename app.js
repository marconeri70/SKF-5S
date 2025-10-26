// SKF 5S Supervisor — single JS (v2.3.3)
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const LOCK_KEY = 'skf5s:lock';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const store = {
    load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch(e){ return []; } },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  const isLocked = () => sessionStorage.getItem(LOCK_KEY) === '1';
  const setLocked = (v) => { sessionStorage.setItem(LOCK_KEY, v?'1':'0'); paintLock(); applyLock(); };
  const paintLock = () => { const b=$('#btn-lock'); if (b) { b.textContent = isLocked() ? '🔓' : '🔒'; b.title=isLocked()?'Sblocca':'Blocca'; } };
  const applyLock = () => {
    const input = $('#import-input'), btn = $('#btn-import');
    if (!input || !btn) return;
    const L = isLocked();
    input.disabled = L; btn.disabled = L; btn.classList.toggle('disabled', L);
  };

  // --- Notes flattener accepts arrays OR objects keyed by S1/1S/2S...
  function flattenNotes(anyNotes, fallbackDate){
    const out = [];
    if (!anyNotes) return out;
    if (Array.isArray(anyNotes)){
      for (const n of anyNotes){
        out.push({ s: String(n.s||n.S||n.type||''), text: n.text||n.note||'', date: n.date||fallbackDate||'' });
      }
    } else if (typeof anyNotes === 'object'){
      const keys = Object.keys(anyNotes);
      for (const k of keys){
        const arr = Array.isArray(anyNotes[k]) ? anyNotes[k] : [anyNotes[k]];
        const s = (k||'').toString().toUpperCase().replace('S','').replace(' ','');
        const sLabel = (s && s[0]) ? (s[0]+'S') : '';
        for (const item of arr){
          out.push({ s: sLabel, text: (item?.text||item?.note||item||'').toString(), date: (item?.date||fallbackDate||'') });
        }
      }
    }
    return out;
  }

  function normalizeOne(x){
    const points = x.points || {s1:x.s1||x.S1||0,s2:x.s2||x.S2||0,s3:x.s3||x.S3||0,s4:x.s4||x.S4||0,s5:x.s5||x.S5||0};
    const norm = {
      area: x.area || x.Area || x.zona || '',
      channel: x.channel || x.CH || x.linea || x.name || '',
      date: x.date || x.data || x.updatedAt || new Date().toISOString().slice(0,16),
      points: { s1:+(points.s1||0), s2:+(points.s2||0), s3:+(points.s3||0), s4:+(points.s4||0), s5:+(points.s5||0) },
      notes: []
    };
    // Accept notes in many shapes
    const rawNotes = x.notes ?? x.note ?? x.Note ?? x.Notes ?? null;
    norm.notes = flattenNotes(rawNotes, norm.date);
    return norm.channel ? norm : null;
  }

  async function handleImportFileList(fileList){
    if (isLocked()) { alert('Bloccato: sblocca per importare.'); return; }
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area+'|'+r.channel+'|'+r.date, r]));
    for (const f of Array.from(fileList||[])) {
      try{
        const text = await f.text();
        const obj = JSON.parse(text);
        const arr = Array.isArray(obj) ? obj : (obj.records || obj.data || obj.export || [obj]);
        for (const raw of arr){
          const rec = normalizeOne(raw);
          if (rec){
            const k = rec.area+'|'+rec.channel+'|'+rec.date;
            byKey.set(k, rec);
          }
        }
      }catch(e){ alert('File non valido: '+f.name); }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=>(a.channel||'').localeCompare(b.channel||''));
    store.save(merged);
    const input = $('#import-input'); if (input) input.value = '';
    renderAll();
  }

  function renderUnifiedChart(){
    const cvs = $('#unifiedChart'); if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const data = store.load();
    const byCh = new Map();
    for (const r of data){ const arr = byCh.get(r.channel)||[]; arr.push(r); byCh.set(r.channel, arr); }
    const channels = Array.from(byCh.keys());
    const last = channels.map(ch => byCh.get(ch).sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0]);

    const BAR = 9, GAP=3, GROUP_GAP=18, H=200, P=20;
    const width = P*2 + channels.length*(5*BAR + 4*GAP) + (channels.length-1)*GROUP_GAP;
    cvs.width = Math.max(width, 900);
    cvs.height = H;
    ctx.clearRect(0,0,cvs.width,cvs.height);
    const base = H-28;
    ctx.strokeStyle = '#dbe4ff'; ctx.beginPath(); ctx.moveTo(0,base+.5); ctx.lineTo(cvs.width, base+.5); ctx.stroke();

    const colors = ['#7c3aed','#ef4444','#f59e0b','#22c55e','#3b82f6'];
    channels.forEach((ch, gi)=>{
      const r = last[gi]; if (!r) return;
      const vals = [r.points.s1,r.points.s2,r.points.s3,r.points.s4,r.points.s5];
      const start = P + gi*(5*BAR + 4*GAP + GROUP_GAP);
      vals.forEach((v,i)=>{
        const x = start + i*(BAR+GAP);
        const y = base - Math.round((Math.max(0,Math.min(100,v))/100)*(base-P));
        ctx.fillStyle = colors[i]; ctx.fillRect(x, y, BAR, base-y);
      });
      ctx.fillStyle = '#334155'; ctx.font='12px system-ui'; ctx.textAlign='center';
      ctx.fillText(ch, start + 2*BAR + 2*GAP, H-8);
    });

    const legend = $('#boards-legend'); if (legend){
      legend.innerHTML='';
      ['1S','2S','3S','4S','5S'].forEach((lab,i)=>{
        const item = document.createElement('span');
        item.className='key'; item.innerHTML=`<span class="dot" style="background:${colors[i]}"></span>${lab}`;
        legend.appendChild(item);
      });
    }
  }

  function renderHome(){
    if (document.body.dataset.page !== 'home') return;
    const chips = $('#chip-strip'); if (!chips) return;
    chips.innerHTML='';
    const data = store.load();
    const channels = [...new Set(data.map(r=>r.channel).filter(Boolean))];
    channels.forEach(ch=>{
      const b = document.createElement('button');
      b.className='chip'; b.textContent = ch;
      b.onclick = () => location.href = 'checklist.html#'+encodeURIComponent(ch);
      chips.appendChild(b);
    });
    renderUnifiedChart();
  }

  // Build a details row for each S
  function sRow(label, value, sClass){
    const v = Math.max(0, Math.min(100, Number(value||0)));
    return `<div class="s-item ${sClass}">
      <span class="pill ${sClass}">${label} ${v}%</span>
      <div class="s-bar"><i style="width:${v}%;"></i></div>
    </div>`;
  }

  function renderChecklist(){
    if (document.body.dataset.page !== 'checklist') return;
    const wrap = $('#cards'); wrap.innerHTML='';
    const data = store.load();
    const byCh = new Map();
    for (const r of data){ const a = byCh.get(r.channel)||[]; a.push(r); byCh.set(r.channel,a); }

    for (const [ch, arr] of byCh){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((p.s1+p.s2+p.s3+p.s4+p.s5)/5);
      const detailsId = 'line-'+(ch||'').replace(/\s/g,'-');

      const d = document.createElement('details');
      d.className='card-line'; d.id = detailsId;
      d.innerHTML = `
        <summary class="top">
          <div>
            <div style="font-weight:800">CH ${ch}</div>
            <div class="muted" style="font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${p.s1}%</span>
            <span class="pill s2">S2 ${p.s2}%</span>
            <span class="pill s3">S3 ${p.s3}%</span>
            <span class="pill s4">S4 ${p.s4}%</span>
            <span class="pill s5">S5 ${p.s5}%</span>
          </div>
          <div><span class="badge">Voto medio ${avg}%</span></div>
        </summary>
        <div class="card-body">
          ${sRow('1S', p.s1, 's1')}
          ${sRow('2S', p.s2, 's2')}
          ${sRow('3S', p.s3, 's3')}
          ${sRow('4S', p.s4, 's4')}
          ${sRow('5S', p.s5, 's5')}
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem">
            <button class="btn" data-print>Stampa PDF</button>
          </div>
        </div>
      `;
      d.querySelector('[data-print]').onclick = () => printCard(d, ch);
      wrap.appendChild(d);
    }

    // Open CH if hash present
    if (location.hash){
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById('line-'+id.replace(/\s/g,'-'));
      if (target){ target.open = true; target.scrollIntoView({behavior:'smooth', block:'start'}); }
    }

    // Toggle all
    const t = $('#btn-toggle-all');
    if (t){
      t.onclick = () => {
        const all = $$('details.card-line');
        const shouldOpen = all.some(d => !d.open);
        all.forEach(d => d.open = shouldOpen);
      };
    }
  }

  function printCard(el, ch){
    const w = window.open('','_blank');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${ch}</title><link rel="stylesheet" href="style.css"></head><body><div class="container">${el.outerHTML}</div></body></html>`);
    w.document.close(); w.focus(); w.print(); setTimeout(()=>w.close(), 300);
  }

  function renderNotes(){
    if (document.body.dataset.page !== 'notes') return;
    const box = $('#notes-list');
    const data = store.load();
    const rows = [];
    for (const r of data){ rows.push(...flattenNotes(r.notes, r.date).map(n => ({...n, ch:r.channel, area:r.area, date:n.date||r.date}))); }
    function apply(){
      const df = $('#f-from').value, dt = $('#f-to').value, sch = $('#f-ch').value.trim().toLowerCase();
      const filt = rows.filter(x => (!df || x.date >= df) && (!dt || x.date <= dt+'T23:59') && (!sch || (x.ch||'').toLowerCase().includes(sch))).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
      const cnt = $('#note-count'); if (cnt) cnt.textContent = `(${filt.length})`;
      box.innerHTML='';
      if (!filt.length){ box.innerHTML = '<div class="note"><div class="muted">Nessuna nota importata.</div></div>'; return; }
      for (const n of filt){
        const pill = n.s ? 's'+(String(n.s).match(/\d/)?.[0]||'') : '';
        const el = document.createElement('div');
        el.className='note';
        el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> • <span class="pill ${pill}">${n.s||''}</span></div>
          <div class="muted">${n.date}</div></div>
          <div style="margin-top:.5rem;white-space:pre-wrap">${(n.text||'')}</div>`;
        box.appendChild(el);
      }
    }
    $('#f-apply').onclick = apply; apply();
  }

  function exportWithPin(){
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin !== '1234'){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'SKF-5S-supervisor-archive.json'; a.click();
  }

  function initCommon(){
    const btnImp = $('#btn-import'), input = $('#import-input');
    if (btnImp && input){
      btnImp.onclick = () => { if (isLocked()){ alert('Bloccato: sblocca per importare.'); return; } input.click(); };
      input.onchange = () => { handleImportFileList(input.files); };
    }
    $('#btn-export')?.addEventListener('click', exportWithPin);
    $('#btn-export-supervisor')?.addEventListener('click', exportWithPin);
    $('#btn-notes')?.addEventListener('click', () => location.href='notes.html');
    $('#btn-print-all')?.addEventListener('click', () => window.print());
    const lockBtn = $('#btn-lock'); if (lockBtn){ paintLock(); applyLock(); lockBtn.onclick = () => setLocked(!isLocked()); }
  }

  function renderAll(){ renderHome(); renderChecklist(); renderNotes(); }

  window.addEventListener('DOMContentLoaded', () => {
    initCommon(); renderAll();
    if ('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
  });
})();
