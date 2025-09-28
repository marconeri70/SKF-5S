// SKF 5S Supervisor — single JS for all pages
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY = 'skf5s:pin';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Basic store (localStorage)
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn(e); return []; }
    },
    save(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // Merge imported records
  async function handleImport(files) {
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));

    for (const f of files) {
      try {
        const text = await f.text();
        const rec = JSON.parse(text);
        // expected: {area, channel, date, points:{s1..s5}, notes:[...], delays:number}
        if (rec && rec.area && rec.channel && rec.points) {
          const k = rec.area + '|' + rec.channel + '|' + rec.date;
          byKey.set(k, rec); // replace same timestamp import, keep others
        }
      } catch (e) {
        alert('File non valido: ' + f.name);
      }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=> (a.channel||'').localeCompare(b.channel||''));
    store.save(merged);
    alert('Import completato: ' + merged.length + ' record totali');
    render();
  }

  // Simple chart renderer (no libs). Expects container and value array [s1..s5, delays?]
  function renderBars(el, values, labels=['1S','2S','3S','4S','5S']){
    el.innerHTML = '';
    const max = Math.max(100, ...values);
    labels.forEach((lab, i) => {
      const v = values[i] || 0;
      const bar = document.createElement('div');
      bar.className = 'bar s' + (i+1);
      bar.style.height = Math.round(v/max*100) + '%';
      const span = document.createElement('span');
      span.textContent = lab;
      bar.appendChild(span);
      el.appendChild(bar);
    });
  }

  // Build boards on home
  function renderHome() {
    const data = store.load();
    const boards = $('#boards');
    const chips = $('#chip-strip');
    if (!boards) return;

    boards.innerHTML = '';
    chips.innerHTML = '';

    // group by channel
    const byCh = new Map();
    for (const r of data) {
      const key = r.channel || 'CH?';
      const arr = byCh.get(key) || [];
      arr.push(r); byCh.set(key, arr);
    }

    // chips
    for (const ch of byCh.keys()) {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chips.appendChild(chip);
    }

    // boards with last snapshot per CH
    for (const [ch, arr] of byCh) {
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const card = document.createElement('div');
      card.className = 'board';
      card.innerHTML = `<h3>${ch} <small class="muted">${last?.area||''}</small></h3>
        <div class="chart" id="chart-${CSS.escape(ch)}"></div>
        <div class="muted" style="margin-top:.4rem">Ultimo: ${last?.date||'-'}</div>
        <div style="display:flex;gap:.5rem;margin-top:.4rem">
          <button class="btn" onclick="window.open('checklist.html#${encodeURIComponent(ch)}','_self')">Apri in checklist</button>
          <button class="btn" onclick="window.print()">Stampa PDF</button>
        </div>`;
      boards.appendChild(card);
      const vals = [last?.points?.s1||0, last?.points?.s2||0, last?.points?.s3||0, last?.points?.s4||0, last?.points?.s5||0];
      renderBars($('#chart-'+CSS.escape(ch)), vals);
    }
  }

  // Build checklist lines per CH
  function renderChecklist() {
    const wrap = $('#cards');
    if (!wrap) return;
    const data = store.load();

    const byCh = new Map();
    for (const r of data) {
      const key = r.channel || 'CH?';
      const arr = byCh.get(key) || [];
      arr.push(r); byCh.set(key, arr);
    }

    wrap.innerHTML = '';
    for (const [ch, arr] of byCh) {
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const kpis = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((kpis.s1+kpis.s2+kpis.s3+kpis.s4+kpis.s5)/5);

      const card = document.createElement('div');
      card.className = 'card-line';
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${ch}</div>
            <div class="muted" style="font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${kpis.s1}%</span>
            <span class="pill s2">S2 ${kpis.s2}%</span>
            <span class="pill s3">S3 ${kpis.s3}%</span>
            <span class="pill s4">S4 ${kpis.s4}%</span>
            <span class="pill s5">S5 ${kpis.s5}%</span>
          </div>
          <div class="kpi"><span class="badge">Voto medio ${avg}%</span></div>
          <div><button class="btn" onclick="window.print()">Stampa PDF</button></div>
        </div>
      `;
      wrap.appendChild(card);
    }
  }

  // Build notes page
  function renderNotes() {
    const box = $('#notes-list');
    if (!box) return;
    const data = store.load();
    box.innerHTML = '';

    // Flatten notes: each record may have notes like [{s:'1S', text:'..', date:'..'}]
    const rows = [];
    for (const r of data) {
      const arr = Array.isArray(r.notes) ? r.notes : [];
      for (const n of arr) {
        rows.push({
          ch: r.channel,
          area: r.area,
          s: n.s || n.S || n.type || '',
          text: n.text || n.note || '',
          date: n.date || r.date || ''
        });
      }
    }
    if (!rows.length) {
      box.innerHTML = '<div class="muted">Nessuna nota importata.</div>';
      return;
    }
    rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
    for (const n of rows) {
      const el = document.createElement('div');
      el.className = 'note';
      el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
        <div><strong>${n.ch}</strong> • <span class="pill ${n.s?('s'+n.s[0]):''}">${n.s||''}</span></div>
        <div class="muted">${n.date}</div></div>
        <div style="margin-top:.4rem">${(n.text||'').replaceAll('\n','<br>')}</div>`;
      box.appendChild(el);
    }
  }

  // Export protected (dummy PIN check)
  function exportWithPin(){
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin !== '1234'){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // Lock button (visual only)
  function initLock(){
    const btn = $('#btn-lock');
    if (!btn) return;
    let locked = sessionStorage.getItem('lock') === '1';
    const paint = () => btn.textContent = locked ? '🔓' : '🔒';
    paint();
    btn.onclick = () => { locked = !locked; sessionStorage.setItem('lock', locked?'1':'0'); paint(); };
  }

  // Attach common listeners
  function initCommon(){
    const input = $('#import-input');
    if (input) input.onchange = () => handleImport(input.files);
    const exp = $('#btn-export');
    if (exp) exp.onclick = exportWithPin;
    const exp2 = $('#btn-export-supervisor');
    if (exp2) exp2.onclick = exportWithPin;
  }

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // Run
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();
    if ('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
  });
})();
