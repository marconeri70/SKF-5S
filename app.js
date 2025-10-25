// SKF 5S Supervisor — v2.3.5 (single JS per tutte le pagine)
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const LOCK_KEY = 'skf5s:lock';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // local store
  const store = {
    load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch(e){return []}},
    save(a){ localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); }
  };

  // ---------- Import ----------
  async function handleImport(files){
    if(!files || !files.length) return;
    const cur = store.load();
    const map = new Map(cur.map(r => [keyOf(r), r]));
    for(const f of files){
      try{
        const txt = await f.text();
        const obj = JSON.parse(txt);
        // accetta array o singolo record
        const items = Array.isArray(obj) ? obj : [obj];
        for (const rec of items){
          if(!rec || !rec.channel || !rec.points) continue;
          // normalizza date
          if(!rec.date) rec.date = new Date().toISOString();
          // se punti in s1..s5 numerici o stringhe, parse
          for(const k of ['s1','s2','s3','s4','s5']){
            if(rec.points && rec.points[k]!=null) rec.points[k] = Number(rec.points[k])||0;
          }
          map.set(keyOf(rec), rec);
        }
      }catch(e){
        alert('File non valido: '+f.name);
      }
    }
    const merged = Array.from(map.values())
      .sort((a,b)=> (a.channel||'').localeCompare(b.channel||'') || new Date(a.date)-new Date(b.date));
    store.save(merged);
    const input = $('#import-input'); if(input) input.value = ''; // re-import abilitato
    render(); // aggiorna tutte le pagine
  }
  const keyOf = r => (r.area||'')+'|'+(r.channel||'')+'|'+(r.date||'');

  // ---------- Lock ----------
  function applyLockUI(locked){
    // disattiva gli elementi di editing, se marcati lockable
    $$('.lockable').forEach(el => el.toggleAttribute('disabled', locked));
    const b = $('#btn-lock');
    if(b) b.textContent = locked ? '🔓' : '🔒';
  }
  function initLock(){
    let locked = (sessionStorage.getItem(LOCK_KEY) === '1');
    applyLockUI(locked);
    const b = $('#btn-lock');
    if(b) b.onclick = () => {
      locked = !locked;
      sessionStorage.setItem(LOCK_KEY, locked ? '1' : '0');
      applyLockUI(locked);
    };
  }

  // ---------- Charts (canvas puro) ----------
  function drawUnifiedBars(canvas, groups){
    if(!canvas) return;
    const P = 14;                   // padding interno
    const barH = 10, gap = 6;       // barre piccole
    const groupGap = 26;            // spazio tra CH
    const barsPerGroup = 5;

    const neededW = Math.max(700, groups.length * (barsPerGroup*(barH+gap) + groupGap) + 120);
    const H = canvas.height;
    canvas.width = neededW;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,H);
    ctx.font = '12px system-ui';

    // griglia orizzontale 0-100%
    ctx.fillStyle = '#eef2ff';
    for(let i=0;i<=5;i++){
      const y = P + i*(H-P*2)/5;
      ctx.fillRect(P, y, canvas.width-P*2, 1);
    }

    const colors = ['#7e3af2','#e11d48','#f59e0b','#10b981','#2563eb']; // S1..S5
    let x = P+40;
    groups.forEach(g=>{
      const vals = [g.s1||0,g.s2||0,g.s3||0,g.s4||0,g.s5||0];
      for(let i=0;i<5;i++){
        const y = P + i*(barH+gap);
        ctx.fillStyle = colors[i];
        const w = Math.max(2, (canvas.width - x - 80) * Math.min(100, vals[i]) / 100);
        ctx.fillRect(x, y, w, barH);
        // etichetta S
        ctx.fillStyle = '#334155';
        ctx.fillText(`S${i+1}`, x-28, y+barH-1);
      }
      // nome CH sotto
      ctx.fillStyle = '#334155';
      ctx.fillText(g.ch, x-18, P + 5*(barH+gap) + 14);
      x += (barsPerGroup*(barH+gap) + groupGap);
    });
  }

  function drawCardBars(canvas, vals){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const P = 18, barH=14, gap=10;
    const W = canvas.clientWidth || 520, H = P*2 + 5*(barH+gap) + 8;
    canvas.width = W; canvas.height = H;
    ctx.clearRect(0,0,W,H);
    const colors = ['#7e3af2','#e11d48','#f59e0b','#10b981','#2563eb'];
    ctx.font = '12px system-ui';
    for(let i=0;i<5;i++){
      const y = P + i*(barH+gap);
      ctx.fillStyle = '#eef2ff';
      ctx.fillRect(P, y, W-P*2, barH);
      ctx.fillStyle = colors[i];
      const w = Math.round((W-P*2)*Math.min(100,vals[i])/100);
      ctx.fillRect(P, y, Math.max(2,w), barH);
      ctx.fillStyle = '#334155';
      ctx.fillText(`S${i+1} ${vals[i]}%`, P, y-2);
    }
  }

  // ---------- Home ----------
  function renderHome(){
    if(!$('[data-page="home"]')) return;
    const data = store.load();
    // CH raggruppati -> ultimo record
    const map = new Map();
    for(const r of data){ map.set(r.channel, r); }
    const groups = Array.from(map.entries()).map(([ch,r])=>({
      ch, s1:r.points?.s1||0, s2:r.points?.s2||0, s3:r.points?.s3||0, s4:r.points?.s4||0, s5:r.points?.s5||0
    }));
    drawUnifiedBars($('#unifiedChart'), groups);

    // legenda
    const legend = $('#chart-legend');
    if(legend){
      legend.innerHTML = `
        <span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span>
      `;
      legend.querySelectorAll('span').forEach((el,i)=>{
        el.className = 'pill s'+(i+1);
      });
    }

    // chip per aprire schede
    const chips = $('#chip-strip');
    chips.innerHTML = '';
    for(const [ch] of map){
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = ch;
      b.onclick = () => location.href = 'checklist.html#'+encodeURIComponent(ch);
      chips.appendChild(b);
    }
  }

  // ---------- Checklist ----------
  function renderChecklist(){
    if(!$('[data-page="checklist"]')) return;
    const wrap = $('#cards'); wrap.innerHTML = '';
    const locked = (sessionStorage.getItem(LOCK_KEY) === '1');

    const byCh = new Map();
    for(const r of store.load()){
      const a = byCh.get(r.channel) || [];
      a.push(r); byCh.set(r.channel,a);
    }
    for(const [ch, arr] of byCh){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const pts = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((pts.s1+pts.s2+pts.s3+pts.s4+pts.s5)/5);

      const card = document.createElement('article');
      card.className = 'card-line';
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${ch}</div>
            <div class="muted">${last?.area||''} • Ultimo: ${last?.date||''}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${pts.s1}%</span>
            <span class="pill s2">S2 ${pts.s2}%</span>
            <span class="pill s3">S3 ${pts.s3}%</span>
            <span class="pill s4">S4 ${pts.s4}%</span>
            <span class="pill s5">S5 ${pts.s5}%</span>
          </div>
          <div><span class="badge">Voto medio ${avg}%</span></div>
          <div><button class="btn" onclick="window.print()">Stampa PDF</button></div>
        </div>
        <div class="scroll-x" style="margin-top:.6rem">
          <canvas class="smallbars"></canvas>
        </div>
      `;
      wrap.appendChild(card);
      const cvs = card.querySelector('canvas');
      drawCardBars(cvs, [pts.s1,pts.s2,pts.s3,pts.s4,pts.s5]);
    }

    // toggle all (qui solo segnaposto che rinfresca la pagina)
    const btnToggle = $('#btn-toggle-all');
    if(btnToggle){
      btnToggle.onclick = () => {
        // Se servisse espandere dettagli reali, agganciare qui.
        alert('Comprimi/Espandi: demo (aggiungeremo dettagli se servono).');
      };
    }
  }

  // ---------- Note ----------
  function renderNotes(){
    if(!$('[data-page="notes"]')) return;
    const out = $('#notes-list');
    const data = store.load();
    const rows = [];

    for(const r of data){
      const notes = (r.notes || r.note || r.comments || []);
      if (Array.isArray(notes) && notes.length){
        for(const n of notes){
          const s = n.s || n.S || n.type || (n.k || '');
          const text = n.text || n.note || n.msg || '';
          rows.push({ch:r.channel, area:r.area, s, text, date: n.date || r.date});
        }
      } else {
        // fallback: se nel JSON hai note per S come array di stringhe (es. r.detail.s1=[...])
        const det = r.detail || r.details || {};
        for(const k of ['s1','s2','s3','s4','s5']){
          const list = det[k] || [];
          if(Array.isArray(list)){
            for(const t of list){
              rows.push({ch:r.channel, area:r.area, s:k.toUpperCase(), text:String(t||''), date:r.date});
            }
          }
        }
      }
    }

    rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
    $('#note-count').textContent = `${rows.length} note`;
    if(!rows.length){ out.innerHTML = '<div class="muted">Nessuna nota importata.</div>'; return; }

    out.innerHTML = '';
    for(const n of rows){
      const el = document.createElement('div');
      el.className = 'note';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> <span class="muted">• ${n.area||''}</span> — <span class="pill ${n.s?('s'+(n.s[1]||n.s[0])):''}">${n.s||''}</span></div>
          <div class="muted">${n.date||''}</div>
        </div>
        <div style="margin-top:.35rem;white-space:pre-wrap">${n.text||''}</div>
      `;
      out.appendChild(el);
    }

    const btnSearch = $('#btn-search-date');
    if(btnSearch){
      btnSearch.onclick = () => {
        const d = prompt('Inserisci data (YYYY-MM-DD):');
        if(!d) return;
        $$('.note').forEach(n=>{
          n.style.display = n.textContent.includes(d) ? '' : 'none';
        });
      };
    }
  }

  // ---------- Export con PIN ----------
  function exportWithPin(){
    const pin = prompt('Inserisci PIN (demo 1234):');
    if(pin!=='1234') return alert('PIN errato');
    const blob = new Blob([JSON.stringify(store.load(),null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // ---------- Common ----------
  function initCommon(){
    const input = $('#import-input');
    if(input) input.onchange = () => handleImport(input.files);
    const bImp = $('#btn-import'); if(bImp) bImp.onclick = () => input.click();
    const bExp = $('#btn-export'); if(bExp) bExp.onclick = exportWithPin;
    const bExpSup = $('#btn-export-supervisor'); if(bExpSup) bExpSup.onclick = exportWithPin;
    const bNotes = $('#btn-notes'); if(bNotes) bNotes.onclick = () => location.href = 'notes.html';
    initLock();
  }

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // ---------- bootstrap ----------
  window.addEventListener('DOMContentLoaded', ()=>{
    initCommon();
    render();
    if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js?v=2.3.5'); }
  });
})();
