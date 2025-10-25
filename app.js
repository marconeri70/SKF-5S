// SKF 5S Supervisor
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const LOCK_KEY = 'skf5s:lock';
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

  /* ===== Utils ===== */
  const keyOf = (r) => `${r.area}|${r.channel}|${r.date || ''}`;
  const channelLabel = (ch) => String(ch || '').replace(/^CH\s+/i,'CH '); // normalizza

  /* ===== Import ===== */
  async function handleImport(files) {
    if (!files || !files.length) return;

    const current = store.load();
    const map = new Map(current.map(r => [keyOf(r), r]));

    for (const f of files) {
      try {
        const txt = await f.text();
        const rec = JSON.parse(txt);
        if (rec?.area && rec?.channel && rec?.points) {
          map.set(keyOf(rec), rec);
        } else {
          alert(`File non valido: ${f.name}`);
        }
      } catch { alert(`File non valido: ${f.name}`); }
    }

    const merged = [...map.values()].sort((a,b)=>
      (a.channel||'').localeCompare(b.channel||'')
    );
    store.save(merged);

    const input = $('#import-input'); if (input) input.value = '';
    alert(`Import completato: ${merged.length} record totali`);
    render();
  }

  /* ===== Aggregazioni ===== */
  function groupByChannelLatest() {
    const all = store.load();
    const by = new Map();
    all.forEach(r => {
      const ch = r.channel || 'CH ?';
      const arr = by.get(ch) || [];
      arr.push(r); by.set(ch, arr);
    });
    const latest = [];
    for (const [ch, arr] of by) {
      const last = arr.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-1)[0];
      if (last) latest.push(last);
    }
    latest.sort((a,b)=>(a.channel||'').localeCompare(b.channel||''));
    return latest;
  }

  /* ===== Grafico HOME: CH sull'asse X, barre verticali e scroll ===== */
  function drawAllCHChart() {
    const cvs = $('#allChart'); if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const latest = groupByChannelLatest();

    const colsPerCH = 5;        // 5S
    const colW = 18;            // larghezza colonna singola
    const gapCol = 6;           // gap tra colonne
    const gapGroup = 22;        // gap tra CH
    const leftPad = 40;         // y axis labels left (percentuali)
    const bottomPad = 60;       // spazio per label CH
    const H = cvs.height;       // fissato da HTML

    const totalCols = latest.length * colsPerCH;
    const Wneed = leftPad + totalCols*colW + (latest.length*4)*gapCol + (latest.length-1)*gapGroup + 40;
    const W = Math.max(cvs.clientWidth || 700, Wneed);
    cvs.width = W;

    ctx.clearRect(0,0,W,H);
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';

    // Asse Y 0..100
    ctx.fillStyle = '#6b7785';
    for (let p=0; p<=100; p+=20){
      const y = mapVal(p, 0,100, H-bottomPad, 16);
      ctx.fillRect(leftPad-6, y, W-leftPad-20, 1);
      ctx.fillText(p+'%', leftPad-20, y+4);
    }

    const colors = ['#7c4dff','#e74c3c','#f39c12','#27ae60','#2e6df6'];
    let x = leftPad + 10;

    latest.forEach((r, idx) => {
      const vals = [r.points?.s1||0,r.points?.s2||0,r.points?.s3||0,r.points?.s4||0,r.points?.s5||0];
      // gruppo di 5 colonne
      vals.forEach((v,i)=>{
        const h = Math.round((H-bottomPad-20) * Math.min(100,v)/100);
        const y = (H-bottomPad) - h;
        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y, colW, h);
        x += colW + gapCol;
      });
      // label CH sotto
      const centerX = x - gapCol - (colsPerCH*colW + 4*gapCol)/2;
      ctx.fillStyle = '#1b2430';
      const label = channelLabel(r.channel);
      wrapText(ctx, label, centerX, H-bottomPad+16, colW*colsPerCH+gapCol*4, 14);
      x += gapGroup;
    });
  }
  function mapVal(v, a,b, A,B){ return A + (v-a)*(B-A)/(b-a); }
  function wrapText(ctx, text, x, y, maxW, lh){
    const words = String(text).split(/\s+/); let line=''; let yy=y;
    for (let n=0;n<words.length;n++){
      const test = line + (line?' ':'') + words[n];
      if (ctx.measureText(test).width > maxW && n>0){ ctx.fillText(line, x, yy); line=words[n]; yy+=lh; }
      else line=test;
    }
    ctx.fillText(line, x, yy);
  }

  /* ===== Checklist ===== */
  function renderChecklist(){
    const wrap = $('#cards'); if (!wrap) return;
    const data = groupByChannelLatest();
    wrap.innerHTML = '';

    data.forEach((r)=>{
      const p = r.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((p.s1+p.s2+p.s3+p.s4+p.s5)/5);

      const card = document.createElement('div');
      card.className = 'card-line';
      card.dataset.channel = r.channel;
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">${channelLabel(r.channel)}</div>
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
          <div><button class="btn outline btn-print-one lockable">Stampa PDF</button></div>
        </div>

        <div class="chart-wrap">
          <canvas height="120" class="mini-chart"></canvas>
        </div>
      `;
      wrap.appendChild(card);
      drawMiniChart($('.mini-chart', card), p);
    });

    // stampa singola
    $$('.btn-print-one', wrap).forEach(btn=>{
      btn.onclick = (e)=>{
        const card = e.currentTarget.closest('.card-line');
        document.body.classList.add('print-single');
        card.classList.add('print-target');
        window.print();
        setTimeout(()=>{
          card.classList.remove('print-target');
          document.body.classList.remove('print-single');
        },200);
      };
    });

    // toggle all (placeholder)
    const t = $('#btn-toggle-all');
    if (t) t.onclick = ()=> alert('Comprimi/Espandi: demo (aggiungeremo dettagli se servono).');

    const pAll = $('#btn-print-all');
    if (pAll) pAll.onclick = ()=> window.print();
  }

  function drawMiniChart(cvs, p){
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.clientWidth || 560;
    const H = cvs.height;
    cvs.width = W;

    const vals = [p.s1||0,p.s2||0,p.s3||0,p.s4||0,p.s5||0];
    const colors = ['#7c4dff','#e74c3c','#f39c12','#27ae60','#2e6df6'];
    const gap = 10, barH = 18, left = 70, usableW = W - left - 16;

    ctx.clearRect(0,0,W,H);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#6b7785';
    ['1S','2S','3S','4S','5S'].forEach((lab,i)=>{
      const y = 10 + i*(barH+gap);
      ctx.fillText(lab, 10, y+barH/2);
      const w = Math.round(usableW * Math.min(100, vals[i]) / 100);
      ctx.fillStyle = colors[i];
      ctx.fillRect(left, y, w, barH);
    });
  }

  /* ===== Notes ===== */
  function renderNotes(){
    const list = $('#notes-list'); const counter = $('#notes-count');
    if (!list) return;

    const all = store.load();
    const rows = [];
    all.forEach(r=>{
      // 1) campo notes array diretto
      if (Array.isArray(r.notes)){
        r.notes.forEach(n=> rows.push(formatNote(r, n.s||n.S||n.type, n.text||n.note, n.date)));
      }
      // 2) campi s1..s5 con items/note
      ['s1','s2','s3','s4','s5'].forEach(k=>{
        const section = r[k];
        if (Array.isArray(section)){
          section.forEach(item=>{
            if (item?.note||item?.text) rows.push(formatNote(r, k.toUpperCase(), item.note||item.text, item.date));
          });
        } else if (section && typeof section==='object'){
          (section.items||section.note||section.notes||[]).forEach?.((it)=>{
            if (it?.note||it?.text) rows.push(formatNote(r, k.toUpperCase(), it.note||it.text, it.date));
          });
        }
      });
      // 3) fallback: scorri tutte le proprietà e raccogli chiavi note/comment
      sweepNotes(r, (s,t,d)=> rows.push(formatNote(r,s,t,d)));
    });

    rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
    list.innerHTML = rows.length? '' : '<div class="muted">Nessuna nota importata.</div>';

    rows.forEach(n=>{
      const el = document.createElement('div');
      el.className = 'note';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div><strong>${channelLabel(n.ch)}</strong> • <span class="pill ${n.s?('s'+String(n.s).replace(/\D/g,'')[0]):''}">${n.s||''}</span></div>
          <div class="muted">${n.date}</div>
        </div>
        <div style="margin-top:.4rem">${(n.text||'').replaceAll('\n','<br>')}</div>
      `;
      list.appendChild(el);
    });
    if (counter) counter.textContent = `${rows.length} note`;

    const searchBtn = $('#btn-search-notes');
    if (searchBtn){
      searchBtn.onclick = ()=>{
        const day = prompt('Inserisci una data (YYYY-MM-DD):');
        if (!day) return;
        const count = rows.filter(r => String(r.date).startsWith(day)).length;
        alert(`Trovate ${count} note in data ${day}.`);
      };
    }
  }

  function formatNote(r, s, text, date){
    return {
      ch: r.channel,
      area: r.area,
      s: s || '',
      text: text || '',
      date: date || r.date || ''
    };
  }
  function sweepNotes(obj, push, path='', level=0){
    if (level>3 || !obj || typeof obj!=='object') return;
    for (const [k,v] of Object.entries(obj)){
      const key = k.toLowerCase();
      if (['note','notes','comment','comments'].includes(key)){
        if (Array.isArray(v)){ v.forEach(x=> push(path, x?.s||path, x?.text||x?.note||String(x), x?.date)); }
        else if (typeof v==='string'){ push(path, path, v, obj.date); }
      }
      if (['s1','s2','s3','s4','s5'].includes(key) && (v?.items||v)){
        const arr = Array.isArray(v)? v : (v.items||[]);
        arr.forEach(it=>{
          if (it?.note||it?.text) push(key.toUpperCase(), key.toUpperCase(), it.note||it.text, it.date);
        });
      }
      if (v && typeof v==='object') sweepNotes(v, push, k, level+1);
    }
  }

  /* ===== Export con PIN ===== */
  function exportWithPin(){
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin !== PIN){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  /* ===== Lock ===== */
  function applyLockUI(locked){
    document.body.classList.toggle('locked', locked);
    $$('.lockable').forEach(b => b.disabled = locked);
    const l = $('#btn-lock'); if (l) l.textContent = locked ? '🔓' : '🔒';
  }
  function initLock(){
    let locked = sessionStorage.getItem(LOCK_KEY) === '1';
    applyLockUI(locked);
    const btn = $('#btn-lock');
    if (btn){
      btn.onclick = ()=>{
        locked = !locked;
        sessionStorage.setItem(LOCK_KEY, locked?'1':'0');
        applyLockUI(locked);
      };
    }
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

    // chip dei CH (home)
    const strip = $('#chip-strip');
    if (strip){
      strip.innerHTML = '';
      groupByChannelLatest().forEach(r=>{
        const b = document.createElement('button');
        b.className = 'chip';
        b.textContent = channelLabel(r.channel);
        b.onclick = ()=> location.href='checklist.html#'+encodeURIComponent(r.channel);
        strip.appendChild(b);
      });
    }
  }

  /* ===== Boot ===== */
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();
    if ('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
  });
})();
