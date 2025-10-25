// SKF 5S Supervisor — versione corretta 2.3.6
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const LOCK_KEY = 'skf5s:lock';
  const PIN = '1234';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------------------- STORAGE ----------------------
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch { return []; }
    },
    save(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  const keyOf = r => `${r.area||''}|${r.channel||''}|${r.date||''}`;

  // ---------------------- IMPORT ----------------------
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
    const input = $('#import-input'); if (input) input.value = '';
    render();
  }

  // ---------------------- BLOCCO / SBLOCCO ----------------------
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

  // ---------------------- GRAFICI ----------------------
  function drawCardBars(canvas, vals) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = ['#7e3af2','#e11d48','#f59e0b','#10b981','#2563eb'];
    const labels = ['1S','2S','3S','4S','5S'];
    const gap = 8, h = 16, W = canvas.clientWidth || 500, H = 130;
    canvas.width = W; canvas.height = H;
    ctx.font = '13px system-ui';
    ctx.clearRect(0,0,W,H);
    for (let i=0;i<5;i++) {
      const y = 10 + i*(h+gap);
      ctx.fillStyle = '#eef2ff';
      ctx.fillRect(70, y, W-90, h);
      ctx.fillStyle = colors[i];
      ctx.fillRect(70, y, (W-90)*vals[i]/100, h);
      ctx.fillStyle = '#334155';
      ctx.fillText(labels[i], 10, y+h-2);
    }
  }

  function drawUnifiedChart() {
    const cvs = $('#unifiedChart'); if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const data = store.load();
    const latest = [];
    const map = new Map();
    for (const r of data) map.set(r.channel, r);
    for (const [ch, r] of map) {
      latest.push({ ch, s1:r.points?.s1||0, s2:r.points?.s2||0, s3:r.points?.s3||0, s4:r.points?.s4||0, s5:r.points?.s5||0 });
    }

    const barW = 18, gap = 8, groupGap = 20;
    const cols = latest.length * 5;
    const W = Math.max(700, latest.length*(5*(barW+gap)+groupGap)+60);
    const H = cvs.height;
    cvs.width = W;
    ctx.clearRect(0,0,W,H);
    const colors = ['#7e3af2','#e11d48','#f59e0b','#10b981','#2563eb'];

    let x = 40;
    latest.forEach((r, idx) => {
      const vals = [r.s1,r.s2,r.s3,r.s4,r.s5];
      vals.forEach((v,i)=>{
        ctx.fillStyle = colors[i];
        ctx.fillRect(x, H-20 - (v*1.8), barW, v*1.8);
        x += barW + gap;
      });
      ctx.fillStyle = '#334155';
      ctx.fillText(r.ch, x - 70, H-5);
      x += groupGap;
    });
  }

  // ---------------------- CHECKLIST ----------------------
  function renderChecklist() {
    const wrap = $('#cards'); if (!wrap) return;
    const data = store.load();
    const byCh = new Map();
    for (const r of data) {
      const arr = byCh.get(r.channel) || [];
      arr.push(r); byCh.set(r.channel, arr);
    }

    wrap.innerHTML = '';
    byCh.forEach((arr,ch)=>{
      const r = arr[arr.length-1];
      const p = r.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((p.s1+p.s2+p.s3+p.s4+p.s5)/5);

      const card = document.createElement('div');
      card.className = 'card-line';
      card.innerHTML = `
        <div class="top">
          <div><b>${ch}</b><div class="muted">${r.area||''} — ${r.date||''}</div></div>
          <div class="pills">
            <span class="pill s1">S1 ${p.s1}%</span>
            <span class="pill s2">S2 ${p.s2}%</span>
            <span class="pill s3">S3 ${p.s3}%</span>
            <span class="pill s4">S4 ${p.s4}%</span>
            <span class="pill s5">S5 ${p.s5}%</span>
          </div>
          <div class="badge">Media ${avg}%</div>
          <div><button class="btn print-one">Stampa PDF</button></div>
        </div>
        <div class="scroll-x"><canvas height="120"></canvas></div>
      `;
      wrap.appendChild(card);
      drawCardBars(card.querySelector('canvas'), [p.s1,p.s2,p.s3,p.s4,p.s5]);
    });

    // stampa singola
    $$('.print-one', wrap).forEach(btn => {
      btn.onclick = e => {
        const card = e.target.closest('.card-line');
        card.classList.add('print-target');
        window.print();
        setTimeout(()=> card.classList.remove('print-target'), 500);
      };
    });

    // comprimi/espandi
    const toggleBtn = $('#btn-toggle-all');
    if (toggleBtn) {
      let collapsed = false;
      toggleBtn.onclick = () => {
        collapsed = !collapsed;
        $$('.card-line canvas').forEach(c => c.parentElement.style.display = collapsed ? 'none' : '');
        toggleBtn.textContent = collapsed ? 'Espandi tutti i CH' : 'Comprimi tutti i CH';
      };
    }
  }

  // ---------------------- NOTE ----------------------
  function renderNotes() {
    const out = $('#notes-list'); if (!out) return;
    const all = store.load();
    const rows = [];
    all.forEach(r => {
      if (Array.isArray(r.notes)) {
        r.notes.forEach(n => rows.push({ ch:r.channel, s:n.s||'', text:n.text||n.note||'', date:n.date||r.date||'' }));
      }
      for (const s of ['s1','s2','s3','s4','s5']) {
        const list = r[s];
        if (Array.isArray(list)) list.forEach(x => rows.push({ ch:r.channel, s:s.toUpperCase(), text:x.note||x.text||x, date:x.date||r.date||'' }));
      }
    });
    out.innerHTML = rows.length ? '' : '<div class="muted">Nessuna nota importata.</div>';
    rows.forEach(n => {
      const el = document.createElement('div');
      el.className = 'note';
      el.innerHTML = `<b>${n.ch}</b> • <span class="pill ${n.s?('s'+n.s[1]):''}">${n.s}</span>
      <div class="muted">${n.date}</div><div>${n.text}</div>`;
      out.appendChild(el);
    });

    const count = $('#note-count'); if (count) count.textContent = `${rows.length} note`;
    const search = $('#btn-search-date');
    if (search) search.onclick = () => {
      const d = prompt('Inserisci data (YYYY-MM-DD):'); if (!d) return;
      $$('.note').forEach(n => n.style.display = n.textContent.includes(d) ? '' : 'none');
    };
  }

  // ---------------------- EXPORT ----------------------
  function exportWithPin() {
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin !== PIN) return alert('PIN errato');
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor.json';
    a.click();
  }

  // ---------------------- INIT ----------------------
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
  }

  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    render();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=2.3.6');
  });
})();
