// SKF 5S Supervisor — versione corretta 2.3.6
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const LOCK_KEY = 'skf5s:lock';
  const PIN = '1234';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- STORAGE ----------
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch { return []; }
    },
    save(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };
  const keyOf = r => `${r.area||''}|${r.channel||''}|${r.date||''}`;

  // ---------- IMPORT ----------
  async function handleImport(files) {
    if (!files?.length) return;
    const cur = store.load();
    const map = new Map(cur.map(r => [keyOf(r), r]));

    for (const f of files) {
      try {
        const txt = await f.text();
        const json = JSON.parse(txt);
        const arr = Array.isArray(json) ? json : [json];
        for (const rec of arr) {
          if (!rec?.channel || !rec?.points) continue;
          for (const k of ['s1','s2','s3','s4','s5']) rec.points[k] = Number(rec.points[k])||0;
          if (!rec.date) rec.date = new Date().toISOString();
          map.set(keyOf(rec), rec);
        }
      } catch { alert('File non valido: ' + f.name); }
    }
    store.save([...map.values()]);
    const input = $('#import-input'); if (input) input.value = ''; // permette nuovo import
    render();
  }

  // ---------- LOCK ----------
  function applyLockUI(locked) {
    document.body.classList.toggle('locked', locked);
    $$('.lockable').forEach(el => el.disabled = locked);
    const btn = $('#btn-lock');
    if (btn) btn.textContent = locked ? '🔓' : '🔒';
  }
  function initLock() {
    let locked = sessionStorage.getItem(LOCK_KEY) === '1';
    applyLockUI(locked);
    const btn = $('#btn-lock');
    if (btn) btn.onclick = () => {
      locked = !locked;
      sessionStorage.setItem(LOCK_KEY, locked ? '1' : '0');
      applyLockUI(locked);
    };
  }

  // ---------- GRAFICO HOME ----------
  function drawUnifiedChart() {
    const cvs = $('#unifiedChart'); if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const data = store.load();

    // ultimo record per CH
    const lastByCh = new Map();
    for (const r of data) lastByCh.set(r.channel, r);
    const latest = Array.from(lastByCh.entries()).map(([ch, r]) => ({
      ch, s1:r.points?.s1||0, s2:r.points?.s2||0, s3:r.points?.s3||0, s4:r.points?.s4||0, s5:r.points?.s5||0
    }));

    const barW = 18, gap = 8, groupGap = 24;
    const W = Math.max(720, latest.length*(5*(barW+gap)+groupGap)+80);
    const H = cvs.height;
    cvs.width = W;
    ctx.clearRect(0,0,W,H);
    ctx.font = '12px system-ui';

    // griglia
    ctx.fillStyle = '#eef2ff';
    for (let p=0;p<=100;p+=20){
      const y = H-20 - p*1.8;
      ctx.fillRect(40, y, W-60, 1);
    }

    const colors = ['#7e3af2','#e11d48','#f59e0b','#10b981','#2563eb'];
    let x = 50;
    latest.forEach((r) => {
      const vals = [r.s1,r.s2,r.s3,r.s4,r.s5];
      vals.forEach((v,i)=>{
        ctx.fillStyle = colors[i];
        const h = v*1.8;
        ctx.fillRect(x, H-20-h, barW, h);
        x += barW + gap;
      });
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'center';
      ctx.fillText(r.ch, x - (5*(barW+gap))/2, H-4);
      x += groupGap;
    });

    const legend = $('#chart-legend');
    if (legend) legend.innerHTML = ['1S','2S','3S','4S','5S'].map((s,i)=>`<span class="pill s${i+1}">${s}</span>`).join(' ');
  }

  // ---------- MINI GRAFICI CARD ----------
  function drawCardBars(canvas, vals) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = ['#7e3af2','#e11d48','#f59e0b','#10b981','#2563eb'];
    const labels = ['1S','2S','3S','4S','5S'];
    const gap = 10, h = 16, P = 16;
    const W = canvas.clientWidth || 520, H = P*2 + 5*(h+gap);
    canvas.width = W; canvas.height = H;
    ctx.clearRect(0,0,W,H);
    ctx.font = '12px system-ui';
    for (let i=0;i<5;i++){
      const y = P + i*(h+gap);
      ctx.fillStyle = '#eef2ff'; ctx.fillRect(70, y, W-90, h);
      ctx.fillStyle = colors[i]; ctx.fillRect(70, y, (W-90)*Math.min(100,vals[i])/100, h);
      ctx.fillStyle = '#334155'; ctx.fillText(`${labels[i]} ${vals[i]}%`, 10, y+h-2);
    }
  }

  // ---------- CHECKLIST ----------
  function renderChecklist() {
    const wrap = $('#cards'); if (!wrap) return;
    const data = store.load();
    const by = new Map();
    for (const r of data){
      const a = by.get(r.channel)||[]; a.push(r); by.set(r.channel,a);
    }
    wrap.innerHTML = '';
    for (const [ch, arr] of by){
      const r = arr[arr.length-1];
      const p = r.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((p.s1+p.s2+p.s3+p.s4+p.s5)/5);
      const card = document.createElement('div');
      card.className = 'card-line';
      card.innerHTML = `
        <div class="top">
          <div><b>CH ${ch}</b><div class="muted">${r.area||''} — ${r.date||''}</div></div>
          <div class="pills">
            <span class="pill s1">S1 ${p.s1}%</span>
            <span class="pill s2">S2 ${p.s2}%</span>
            <span class="pill s3">S3 ${p.s3}%</span>
            <span class="pill s4">S4 ${p.s4}%</span>
            <span class="pill s5">S5 ${p.s5}%</span>
          </div>
          <div><span class="badge">Media ${avg}%</span></div>
          <div><button class="btn print-one lockable">Stampa PDF</button></div>
        </div>
        <div class="scroll-x" style="margin-top:.6rem">
          <canvas class="smallbars"></canvas>
        </div>`;
      wrap.appendChild(card);
      drawCardBars(card.querySelector('canvas'), [p.s1,p.s2,p.s3,p.s4,p.s5]);
    }

    // stampa singola
    $$('.print-one', wrap).forEach(btn => {
      btn.onclick = e => {
        const card = e.currentTarget.closest('.card-line');
        card.classList.add('print-target');
        window.print();
        setTimeout(()=> card.classList.remove('print-target'), 300);
      };
    });

    // comprimi/espandi reale
    const t = $('#btn-toggle-all');
    if (t){
      let collapsed = false;
      t.onclick = () => {
        collapsed = !collapsed;
        $$('.card-line .scroll-x').forEach(el => el.style.display = collapsed ? 'none' : '');
        t.textContent = collapsed ? 'Espandi tutti i CH' : 'Comprimi / Espandi tutti i CH';
      };
    }
  }

  // ---------- NOTE (robusto) ----------
  function renderNotes() {
    const out = $('#notes-list'); if (!out) return;
    const all = store.load();
    const rows = [];

    all.forEach(r => {
      // A) notes = oggetto con s1..s5 -> stringhe
      if (r.notes && !Array.isArray(r.notes) && typeof r.notes === 'object') {
        for (const [key, val] of Object.entries(r.notes)) {
          if (typeof val === 'string' && val.trim()) {
            rows.push({
              ch: r.channel, area: r.area, s: key.toUpperCase(),
              text: val.trim(), date: (r.dates?.[key]) || r.date || ''
            });
          }
        }
      }
      // B) notes = array di oggetti
      if (Array.isArray(r.notes)) {
        r.notes.forEach(n => rows.push({
          ch: r.channel, area: r.area, s: n.s||n.S||'', text: n.text||n.note||'',
          date: n.date || r.date || ''
        }));
      }
      // C) detail.s1..s5 = array
      if (r.detail && typeof r.detail === 'object') {
        for (const [key, val] of Object.entries(r.detail)) {
          if (Array.isArray(val)) {
            val.forEach(v => {
              if (typeof v === 'string' || typeof v === 'number') {
                rows.push({ ch:r.channel, area:r.area, s:key.toUpperCase(), text:String(v), date:r.date });
              } else if (v && typeof v === 'object' && (v.note || v.text)) {
                rows.push({ ch:r.channel, area:r.area, s:key.toUpperCase(), text:v.note||v.text, date:v.date||r.date });
              }
            });
          }
        }
      }
    });

    rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
    out.innerHTML = rows.length ? '' : '<div class="muted">Nessuna nota importata.</div>';

    rows.forEach(n => {
      const el = document.createElement('div');
      el.className = 'note';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> • <span class="pill ${n.s?('s'+(n.s[1]||n.s[0])):''}">${n.s||''}</span></div>
          <div class="muted">${n.date||''}</div>
        </div>
        <div style="margin-top:.4rem;white-space:pre-wrap">${n.text||''}</div>`;
      out.appendChild(el);
    });

    const count = $('#note-count'); if (count) count.textContent = `${rows.length} note`;
    const search = $('#btn-search-date');
    if (search) search.onclick = () => {
      const d = prompt('Inserisci data (YYYY-MM-DD):');
      if (!d) return;
      $$('.note').forEach(n => n.style.display = n.textContent.includes(d) ? '' : 'none');
    };
  }

  // ---------- EXPORT ----------
  function exportWithPin() {
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin !== PIN) return alert('PIN errato');
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // ---------- COMMON ----------
  function initCommon() {
    const input = $('#import-input');
    if (input) input.onchange = () => handleImport(input.files);
    const imp = $('#btn-import'); if (imp) imp.onclick = () => input.click();
    const exp1 = $('#btn-export'); if (exp1) exp1.onclick = exportWithPin;
    const exp2 = $('#btn-export-supervisor'); if (exp2) exp2.onclick = exportWithPin;
    const notes = $('#btn-notes'); if (notes) notes.onclick = () => location.href = 'notes.html';
    initLock();
  }

  function render() {
    drawUnifiedChart();
    renderChecklist();
    renderNotes();
    // chip CH (home)
    const chips = $('#chip-strip');
    if (chips) {
      chips.innerHTML = '';
      const set = new Set(store.load().map(r => r.channel));
      set.forEach(ch => {
        const b = document.createElement('button');
        b.className = 'chip'; b.textContent = ch;
        b.onclick = () => location.href = 'checklist.html#'+encodeURIComponent(ch);
        chips.appendChild(b);
      });
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    render();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=2.3.6');
  });
})();
