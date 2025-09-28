// SKF 5S Supervisor — single JS for all pages
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';

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
    render();
  }

  // Simple chart renderer (SVG). Expects container and value array [s1..s5]
  function renderBars(el, values, labels=['1S','2S','3S','4S','5S']){
    el.innerHTML = '';
    const max = Math.max(100, ...values);
    const svgNS = 'http://www.w3.org/2000/svg';
    const w = el.clientWidth || 300, h = el.clientHeight || 180;
    const pad = 24;
    const barW = (w - pad*2) / values.length - 10;
    const svg = document.createElementNS(svgNS,'svg');
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    svg.style.width = '100%'; svg.style.height = '100%';
    const colors = ['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)'];

    values.forEach((v,i)=>{
      const x = pad + i*(barW+10);
      const bh = Math.round((v/max) * (h - pad*2));
      const y = h - pad - bh;
      const rect = document.createElementNS(svgNS,'rect');
      rect.setAttribute('x',x); rect.setAttribute('y',y);
      rect.setAttribute('width',barW); rect.setAttribute('height',bh);
      rect.setAttribute('rx','6'); rect.setAttribute('fill',colors[i]);
      svg.appendChild(rect);

      const tx = document.createElementNS(svgNS,'text');
      tx.setAttribute('x', x + barW/2); tx.setAttribute('y', y - 6);
      tx.setAttribute('text-anchor','middle'); tx.setAttribute('font-size','11');
      tx.textContent = v + '%'; svg.appendChild(tx);

      const lb = document.createElementNS(svgNS,'text');
      lb.setAttribute('x', x + barW/2); lb.setAttribute('y', h - pad/2);
      lb.setAttribute('text-anchor','middle'); lb.setAttribute('font-size','11'); lb.setAttribute('fill','#555');
      lb.textContent = labels[i]; svg.appendChild(lb);
    });
    el.appendChild(svg);
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
          <button class="btn" onclick="window.location.href='checklist.html#${encodeURIComponent(ch)}'">Apri in checklist</button>
          <button class="btn" onclick="printChart('${CSS.escape(ch)}')">Stampa PDF</button>
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
      card.id = 'card-' + ch.replace(/\s/g,'-');
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
            <span class="badge">Voto medio ${avg}%</span>
          </div>
          <div><button class="btn ghost" onclick="printOnly('${'card-' + ch.replace(/\s,g','-')}')">Stampa PDF</button></div>
        </div>
        <details open>
          <summary>Checklist S1…S5</summary>
          <div class="muted">Vista riassuntiva per il supervisore (solo punteggi).</div>
        </details>
      `;
      wrap.appendChild(card);
    }

    // master toggle
    const toggler = $('#btn-toggle-all');
    if (toggler) {
      let open = true;
      toggler.onclick = () => {
        open = !open;
        $$('details', wrap).forEach(d => d.open = open);
      };
    }
    // print all
    const printAll = $('#btn-print-all');
    if (printAll) printAll.onclick = () => window.print();
  }

  // Build notes page
  function renderNotes() {
    const box = $('#notes-list');
    if (!box) return;
    const data = store.load();
    box.innerHTML = '';

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
    const count = $('#notes-count');
    if (!rows.length) {
      box.innerHTML = '<div class="muted">Nessuna nota importata.</div>';
      if (count) count.textContent = '0 note';
      return;
    }
    function applyFilters(){
      const df = $('#from-date')?.value, dt = $('#to-date')?.value, sch = $('#search-ch')?.value?.toLowerCase() || '';
      const filtered = rows.filter(n => {
        const okCh = !sch || (n.ch||'').toLowerCase().includes(sch);
        const d = n.date ? new Date(n.date) : null;
        const okFrom = !df || (d && d >= new Date(df));
        const okTo = !dt || (d && d <= new Date(dt+'T23:59:59'));
        return okCh && okFrom && okTo;
      }).sort((a,b)=> new Date(b.date)-new Date(a.date));
      box.innerHTML='';
      filtered.forEach(n=>{
        const el = document.createElement('div');
        el.className = 'note';
        el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> • <span class="pill ${n.s?('s'+n.s[0]):''}">${n.s||''}</span></div>
          <div class="muted">${n.date}</div></div>
          <div style="margin-top:.4rem">${(n.text||'').replaceAll('\\n','<br>')}</div>`;
        box.appendChild(el);
      });
      if (count) count.textContent = filtered.length + ' note';
    }
    $('#btn-filter')?.addEventListener('click', applyFilters);
    $('#btn-clear')?.addEventListener('click', ()=>{ $('#from-date').value=''; $('#to-date').value=''; $('#search-ch').value=''; applyFilters();});
    applyFilters();
  }

  // Export protected (demo PIN 1234)
  function exportWithPin(){
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin !== '1234'){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // Lock button
  function initLock(){
    const btn = $('#btn-lock');
    if (!btn) return;
    let locked = sessionStorage.getItem('lock') === '1';
    const paint = () => { btn.textContent = locked ? '🔓' : '🔒'; document.body.classList.toggle('is-locked', locked); };
    paint();
    btn.onclick = () => { locked = !locked; sessionStorage.setItem('lock', locked?'1':'0'); paint(); };
    const input = $('#import-input');
    if (input) input.disabled = locked;
  }

  // Print helpers
  window.printOnly = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><title>Stampa</title><link rel="stylesheet" href="style.css"><body>`);
    w.document.write(el.outerHTML);
    w.document.write('</body>');
    w.document.close(); w.focus(); w.print(); w.close();
  };
  window.printChart = (chId) => window.print();

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
