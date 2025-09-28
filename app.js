// SKF 5S Supervisor — single JS for all pages
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- Store in localStorage
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn(e); return []; }
    },
    save(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // ---------- Lock state (persist per session)
  function isLocked(){ return sessionStorage.getItem('skf5s:lock') === '1'; }
  function setLocked(v){
    sessionStorage.setItem('skf5s:lock', v ? '1':'0');
    paintLock();
    applyLockToUI();
  }
  function paintLock(){
    const btn = $('#btn-lock');
    if (btn) btn.textContent = isLocked() ? '🔓' : '🔒';
    if (btn) btn.title = isLocked() ? 'Sblocca (import disabilitato)' : 'Blocca';
  }
  function applyLockToUI(){
    const input = $('#import-input');
    const btnImp = $('#btn-import');
    const locked = isLocked();
    if (input) input.disabled = locked;
    if (btnImp) { btnImp.disabled = locked; btnImp.classList.toggle('disabled', locked); }
  }

  // ---------- Helpers
  function toArray(x){
    if (!x) return [];
    if (Array.isArray(x)) return x;
    if (x.records && Array.isArray(x.records)) return x.records;
    return [x];
  }
  function parseOne(raw){
    // Try to accept several shapes
    let area = raw.area || raw.Area || raw.zona || raw.Zona || '';
    let channel = raw.channel || raw.Channel || raw.ch || raw.CH || raw.linea || raw.Linea || '';
    let date = raw.date || raw.data || raw.createdAt || raw.updatedAt || '';
    let points = raw.points || raw.punteggi || {};
    // sometimes s1..s5 are on root
    points = {
      s1: Number(points.s1 ?? raw.s1 ?? 0),
      s2: Number(points.s2 ?? raw.s2 ?? 0),
      s3: Number(points.s3 ?? raw.s3 ?? 0),
      s4: Number(points.s4 ?? raw.s4 ?? 0),
      s5: Number(points.s5 ?? raw.s5 ?? 0),
    };
    // notes array in different forms
    let notes = [];
    if (Array.isArray(raw.notes)) notes = raw.notes;
    else if (Array.isArray(raw.note)) notes = raw.note;
    else if (raw.details || raw.detail) {
      const t = String(raw.details || raw.detail || '');
      if (t.trim()) notes = [{ s:'', text:t, date }];
    }
    return { area, channel, date, points, notes };
  }

  async function handleImport(files) {
    if (!files || !files.length) return;
    if (isLocked()){ alert('Bloccato: sblocca per importare (icona lucchetto).'); return; }

    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));

    for (const f of files) {
      try {
        const txt = await f.text();
        const json = JSON.parse(txt);
        const arr = toArray(json).map(parseOne);
        for (const rec of arr) {
          if (!rec.channel) continue;
          const k = rec.area + '|' + rec.channel + '|' + rec.date;
          byKey.set(k, rec);
        }
      } catch (e) {
        console.error(e);
        alert('File non valido: ' + f.name);
      }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=> (a.channel||'').localeCompare(b.channel||''));
    store.save(merged);
    alert('Import completato. Totale record: '+ merged.length);
    render(); // re-render current page
  }

  // ---------- Charts (simple SVG bars)
  function svgBars(values, labels){
    const max = Math.max(100, ...values);
    const W = 320, H = 140, pad = 24;
    const bw = (W - pad*2) / values.length * 0.6;
    const gap = (W - pad*2) / values.length * 0.4;
    let x = pad;
    const colors = ['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)'];
    let bars = '';
    values.forEach((v,i)=>{
      const h = Math.round((v/max)*(H-pad));
      const y = H - pad - h;
      bars += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" ry="6" fill="${colors[i%colors.length]}"></rect>`;
      bars += `<text x="${x+bw/2}" y="${H-8}" text-anchor="middle" font-size="12" fill="#475569">${labels[i]}</text>`;
      x += bw + gap;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="grafico"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"></rect>
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#eef2f7"/></linearGradient></defs>
      ${bars}</svg>`;
  }

  // ---------- Render HOME
  function renderHome(){
    if (document.body.dataset.page !== 'home') return;
    const data = store.load();
    const boards = $('#boards');
    const chips = $('#chip-strip');
    boards.innerHTML = '';
    chips.innerHTML = '';

    // group by channel
    const byCh = new Map();
    for (const r of data) {
      const key = r.channel || 'CH?';
      const arr = byCh.get(key) || [];
      arr.push(r); byCh.set(key, arr);
    }

    for (const ch of byCh.keys()) {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chips.appendChild(chip);
    }

    for (const [ch, arr] of byCh) {
      const last = arr.slice().sort((a,b)=> new Date(a.date)-new Date(b.date)).pop();
      const vals = [last?.points?.s1||0,last?.points?.s2||0,last?.points?.s3||0,last?.points?.s4||0,last?.points?.s5||0];
      const card = document.createElement('div');
      card.className = 'board';
      card.innerHTML = `<h3>${ch} <small class="muted">${last?.area||''}</small></h3>
        <div class="chart">${svgBars(vals,['1S','2S','3S','4S','5S'])}</div>
        <div class="muted" style="margin-top:.4rem">Ultimo: ${last?.date || '-'}</div>
        <div style="display:flex;gap:.5rem;margin-top:.4rem">
          <button class="btn" onclick="window.open('checklist.html#${encodeURIComponent(ch)}','_self')">Apri in checklist</button>
          <button class="btn" onclick="printSingle('${encodeURIComponent(ch)}')">Stampa PDF</button>
        </div>`;
      boards.appendChild(card);
    }
  }

  // ---------- Render CHECKLIST
  function renderChecklist(){
    if (document.body.dataset.page !== 'checklist') return;
    const wrap = $('#cards');
    const data = store.load();
    const byCh = new Map();
    for (const r of data) {
      const key = r.channel || 'CH?';
      const arr = byCh.get(key) || [];
      arr.push(r); byCh.set(key, arr);
    }
    wrap.innerHTML = '';
    for (const [ch, arr] of byCh) {
      const last = arr.slice().sort((a,b)=> new Date(a.date)-new Date(b.date)).pop();
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((p.s1+p.s2+p.s3+p.s4+p.s5)/5);
      const card = document.createElement('div');
      card.className = 'card-line';
      card.id = `line-${CSS.escape(ch)}`;
      card.innerHTML = `
        <div class="top">
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
          <div class="kpi"><span class="badge">Voto medio ${avg}%</span></div>
          <div><button class="btn" onclick="printCard('${encodeURIComponent(ch)}')">Stampa PDF</button></div>
        </div>
      `;
      wrap.appendChild(card);
    }
    // Toggle all
    const toggleAll = $('#btn-toggle-all');
    if (toggleAll){
      let collapsed = false;
      toggleAll.onclick = () => {
        collapsed = !collapsed;
        // here we might add details in future; currently only header exists, so no-op.
        alert(collapsed ? 'Comprimi: (demo, nessun dettaglio aggiuntivo da comprimere).' : 'Espandi: (demo)');
      };
    }
  }

  // ---------- Render NOTES
  function renderNotes(){
    if (document.body.dataset.page !== 'notes') return;
    const box = $('#notes-list');
    const data = store.load();
    const rows = [];
    for (const r of data) {
      const arr = Array.isArray(r.notes) ? r.notes : [];
      for (const n of arr) {
        rows.push({
          ch: r.channel,
          area: r.area,
          s: (n.s||n.S||n.type||'').toString(),
          text: n.text||n.note||'',
          date: n.date || r.date || ''
        });
      }
    }
    const from = $('#f-from')?.value;
    const to = $('#f-to')?.value;
    const fch = $('#f-ch')?.value?.trim();
    let filtered = rows;
    if (from) filtered = filtered.filter(r => (r.date||'') >= from);
    if (to) filtered = filtered.filter(r => (r.date||'') <= to + 'T99:99');
    if (fch) filtered = filtered.filter(r => (r.ch||'').toLowerCase().includes(fch.toLowerCase()));
    filtered.sort((a,b)=> (b.date||'').localeCompare(a.date||''));

    $('#note-count').textContent = filtered.length ? `(${filtered.length} note)` : '0 note';
    box.innerHTML = '';
    if (!filtered.length){
      box.innerHTML = '<div class="muted">Nessuna nota importata.</div>';
      return;
    }
    for (const n of filtered) {
      const el = document.createElement('div');
      el.className = 'note';
      const pillClass = n.s ? ('s'+String(n.s).replace(/\D/g,'')) : '';
      el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
        <div><strong>${n.ch}</strong> • <span class="pill ${pillClass}">${n.s||''}</span></div>
        <div class="muted">${n.date}</div></div>
        <div style="margin-top:.4rem; white-space:pre-wrap">${n.text}</div>`;
      box.appendChild(el);
    }
  }

  // ---------- Printing
  window.printCard = (chEnc) => {
    const ch = decodeURIComponent(chEnc);
    const node = document.getElementById('line-'+CSS.escape(ch));
    if (!node) return;
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><html><head><title>CH ${ch}</title>
      <meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body>
      <div class="container">${node.outerHTML}</div></body></html>`);
    w.document.close(); w.focus(); w.print();
  };
  window.printSingle = (chEnc) => { window.location.href = 'checklist.html#'+chEnc; };

  // ---------- Common init
  function initCommon(){
    const btnImp = $('#btn-import');
    const input = $('#import-input');
    if (btnImp && input){
      btnImp.onclick = () => { if (isLocked()) { alert('Bloccato: sblocca per importare.'); return; } input.click(); };
      input.onchange = () => handleImport(input.files);
    }

    const exp = $('#btn-export');
    if (exp) exp.onclick = exportWithPin;

    const exp2 = $('#btn-export-supervisor');
    if (exp2) exp2.onclick = exportWithPin;

    const notes = $('#btn-notes');
    if (notes) notes.onclick = () => location.href = 'notes.html';

    const lock = $('#btn-lock');
    if (lock){
      paintLock(); applyLockToUI();
      lock.onclick = () => setLocked(!isLocked());
    }

    const fapply = $('#f-apply');
    if (fapply) fapply.onclick = () => renderNotes();
  }

  function exportWithPin(){
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin !== '1234'){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    render();
    if ('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
  });
})();
