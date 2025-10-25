// SKF 5S Supervisor — unico JS
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const LOCK_KEY = 'skf5s:lock'; // '1' locked
  const PIN = '1234';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ===== Store ===== */
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch { return []; }
    },
    save(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  /* ===== Import ===== */
  async function handleImport(files) {
    if (!files || !files.length) return;

    const current = store.load();
    const map = new Map(current.map(r => [keyOf(r), r]));

    for (const f of files) {
      try {
        const txt = await f.text();
        const rec = JSON.parse(txt);
        // accettiamo {area, channel, date, points:{s1..s5}, notes?[]}
        if (rec?.area && rec?.channel && rec?.points) {
          map.set(keyOf(rec), rec);
        } else {
          alert(`File non valido: ${f.name}`);
        }
      } catch {
        alert(`File non valido: ${f.name}`);
      }
    }

    const merged = [...map.values()].sort((a, b) =>
      (a.channel || '').localeCompare(b.channel || '')
    );
    store.save(merged);

    // reset input per permettere altri import consecutivi
    const input = $('#import-input');
    if (input) input.value = '';

    alert(`Import completato: ${merged.length} record totali`);
    render();
  }

  const keyOf = (r) => `${r.area}|${r.channel}|${r.date || ''}`;

  /* ===== Charts (canvas) ===== */
  function drawAllCHChart() {
    const cvs = $('#allChart');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const data = latestByChannel();

    // dimensioni responsive
    const W = cvs.clientWidth || cvs.parentElement.clientWidth || 600;
    const chCount = data.length || 1;
    const H = 36 + chCount * 28 + 20; // altezza in base ai CH
    cvs.width = W; cvs.height = H;

    // sfondo pulito
    ctx.clearRect(0, 0, W, H);

    // parametri
    const leftPad = 90;      // per label CH
    const barH = 6;          // spessore di ogni S
    const rowH = 28;         // spazio per CH (5 barre incluse)
    const barGap = 3;        // gap tra S
    const usableW = W - leftPad - 16;
    const colors = ['#7c4dff','#e74c3c','#f39c12','#27ae60','#2e6df6'];

    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6b7785';

    data.forEach((item, idx) => {
      const yTop = 18 + idx * rowH;

      // Label CH
      ctx.fillStyle = '#1b2430';
      ctx.fillText(String(item.channel), 10, yTop + rowH/2);

      // 5 barre S1..S5
      const vals = [
        item.points?.s1 || 0,
        item.points?.s2 || 0,
        item.points?.s3 || 0,
        item.points?.s4 || 0,
        item.points?.s5 || 0
      ];

      let y = yTop;
      vals.forEach((v, i) => {
        const w = Math.round(usableW * Math.min(100, v) / 100);
        ctx.fillStyle = colors[i];
        ctx.fillRect(leftPad, y, w, barH);
        y += barH + barGap;
      });

      // Etichetta percentuali (media)
      const avg = Math.round((vals[0]+vals[1]+vals[2]+vals[3]+vals[4]) / 5);
      ctx.fillStyle = '#6b7785';
      ctx.fillText(`Voto ${avg}%`, W - 80, yTop + rowH/2);
    });
  }

  function latestByChannel() {
    const list = store.load();
    const byCh = new Map();
    for (const r of list) {
      const ch = r.channel || 'CH?';
      const arr = byCh.get(ch) || [];
      arr.push(r);
      byCh.set(ch, arr);
    }
    const latest = [];
    for (const [ch, arr] of byCh) {
      const last = arr
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-1)[0];
      if (last) latest.push(last);
    }
    // aggiorna i chip
    const strip = $('#chip-strip');
    if (strip) {
      strip.innerHTML = '';
      latest.forEach((r) => {
        const b = document.createElement('button');
        b.className = 'chip';
        b.textContent = r.channel;
        b.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(r.channel);
        strip.appendChild(b);
      });
    }
    return latest;
  }

  /* ===== Checklist render ===== */
  function renderChecklist() {
    const wrap = $('#cards');
    if (!wrap) return;

    const data = latestByChannel()
      .sort((a,b) => (a.channel||'').localeCompare(b.channel||''));
    wrap.innerHTML = '';

    data.forEach((r, idx) => {
      const p = r.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((p.s1+p.s2+p.s3+p.s4+p.s5)/5);

      const card = document.createElement('div');
      card.className = 'card-line';
      card.dataset.channel = r.channel;
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${r.channel}</div>
            <div class="muted" style="font-size:.9rem">${r.area} • Ultimo: ${r.date || '-'}</div>
          </div>

          <div class="pills">
            <span class="pill s1">S1 ${p.s1}%</span>
            <span class="pill s2">S2 ${p.s2}%</span>
            <span class="pill s3">S3 ${p.s3}%</span>
            <span class="pill s4">S4 ${p.s4}%</span>
            <span class="pill s5">S5 ${p.s5}%</span>
          </div>

          <div class="kpi"><span class="badge">Voto medio ${avg}%</span></div>

          <div>
            <button class="btn outline btn-print-one">Stampa PDF</button>
          </div>
        </div>

        <div class="chart-wrap">
          <canvas height="120" class="mini-chart"></canvas>
        </div>
      `;
      wrap.appendChild(card);

      // disegna mini chart per card
      drawMiniChart($('.mini-chart', card), p);
    });

    // Stampa solo card
    $$('.btn-print-one', wrap).forEach(btn => {
      btn.onclick = (e) => {
        const card = e.currentTarget.closest('.card-line');
        document.body.classList.add('print-single');
        card.classList.add('print-target');
        window.print();
        setTimeout(() => {
          card.classList.remove('print-target');
          document.body.classList.remove('print-single');
        }, 250);
      };
    });

    // Toggle all (demo: qui solo alert se vuoi espansioni ulteriori)
    const toggle = $('#btn-toggle-all');
    if (toggle) {
      toggle.onclick = () => alert('Comprimi/Espandi: demo (aggiungeremo dettagli se servono).');
    }

    // Stampa tutti
    const printAll = $('#btn-print-all');
    if (printAll) printAll.onclick = () => window.print();
  }

  function drawMiniChart(cvs, p){
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.clientWidth || 560;
    const H = cvs.height;
    cvs.width = W;

    const vals = [p.s1||0,p.s2||0,p.s3||0,p.s4||0,p.s5||0];
    const colors = ['#7c4dff','#e74c3c','#f39c12','#27ae60','#2e6df6'];
    const gap = 8, barH = 14, left = 80, usableW = W - left - 16;

    ctx.clearRect(0,0,W,H);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#6b7785';
    ['1S','2S','3S','4S','5S'].forEach((lab,i)=>{
      const y = 12 + i*(barH+gap);
      ctx.fillText(lab, 10, y+barH/2);
      const w = Math.round(usableW * Math.min(100, vals[i]) / 100);
      ctx.fillStyle = colors[i];
      ctx.fillRect(left, y, w, barH);
    });
  }

  /* ===== Notes render ===== */
  function renderNotes() {
    const list = $('#notes-list');
    const counter = $('#notes-count');
    if (!list) return;

    const data = store.load();
    const rows = [];
    data.forEach(r => {
      (Array.isArray(r.notes) ? r.notes : []).forEach(n => {
        rows.push({
          ch: r.channel,
          area: r.area,
          s: n.s || n.S || n.type || '',
          text: n.text || n.note || '',
          date: n.date || r.date || ''
        });
      });
    });

    rows.sort((a,b)=> new Date(b.date) - new Date(a.date));
    list.innerHTML = '';

    if (!rows.length){
      list.innerHTML = '<div class="muted">Nessuna nota importata.</div>';
    } else {
      rows.forEach(n=>{
        const el = document.createElement('div');
        el.className = 'note';
        el.innerHTML = `
          <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
            <div><strong>${n.ch}</strong> • <span class="pill ${n.s?('s'+String(n.s).replace(/\D/g,'')[0]):''}">${n.s||''}</span></div>
            <div class="muted">${n.date}</div>
          </div>
          <div style="margin-top:.4rem">${(n.text||'').replaceAll('\n','<br>')}</div>
        `;
        list.appendChild(el);
      });
    }
    if (counter) counter.textContent = `${rows.length} note`;
    const searchBtn = $('#btn-search-notes');
    if (searchBtn){
      searchBtn.onclick = ()=>{
        const day = prompt('Inserisci una data (YYYY-MM-DD):');
        if (!day) return;
        const filtered = rows.filter(r => String(r.date).startsWith(day));
        alert(`Trovate ${filtered.length} note in data ${day}.`);
      };
    }
  }

  /* ===== Export con PIN (archivio completo) ===== */
  function exportWithPin() {
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin !== PIN) { alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  /* ===== Lock ===== */
  function initLock(){
    const btn = $('#btn-lock');
    if (!btn) return;
    let locked = sessionStorage.getItem(LOCK_KEY) === '1';
    const paint = () => btn.textContent = locked ? '🔓' : '🔒';
    paint();
    btn.onclick = () => {
      locked = !locked;
      sessionStorage.setItem(LOCK_KEY, locked ? '1' : '0');
      paint();
    };
  }

  /* ===== Common bindings ===== */
  function initCommon(){
    const input = $('#import-input');
    const importBtn = $('#btn-import');
    if (importBtn && input) importBtn.onclick = () => input.click();
    if (input) input.onchange = () => handleImport(input.files);

    const exp1 = $('#btn-export');
    if (exp1) exp1.onclick = exportWithPin;
    const exp2 = $('#btn-export-supervisor');
    if (exp2) exp2.onclick = exportWithPin;

    const notes = $('#btn-notes');
    if (notes) notes.onclick = () => location.href = 'notes.html';
  }

  function render(){
    drawAllCHChart();
    renderChecklist();
    renderNotes();
  }

  /* ===== Boot ===== */
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();
    if ('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js');
    }
  });

})();
