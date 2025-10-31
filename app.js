// SKF 5S Supervisor – build 2.3.12 (Home orizzontale + Checklist toggle + delay link) 
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const store = {
    load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch{ return []; } },
    save(v){ localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }
  };

  const pct = v => `${Math.round(Number(v)||0)}%`;
  const mean = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);

  /* ---------------- PIN / Export ---------------- */
  function exportAll(){
    const pinSaved = localStorage.getItem(PIN_KEY);
    const ask = prompt('Inserisci PIN (demo 1234):','');
    if ((pinSaved && ask!==pinSaved) || (!pinSaved && ask!=='1234')){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(),null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='SKF-5S-supervisor-archive.json'; a.click();
  }
  function initLock(){
    const b = $('#btn-lock'); if(!b) return;
    const paint = () => { b.textContent = localStorage.getItem(PIN_KEY) ? '🔓' : '🔒'; };
    paint();
    b.onclick = () => {
      const old = localStorage.getItem(PIN_KEY);
      if (old){
        const chk = prompt('PIN attuale?'); if (chk!==old) return alert('PIN errato');
        const n1 = prompt('Nuovo PIN (4-10 cifre):'); if(!n1) return;
        const n2 = prompt('Conferma nuovo PIN:');     if(n1!==n2) return alert('Non coincide');
        localStorage.setItem(PIN_KEY,n1);
      }else{
        const p = prompt('Imposta PIN (demo 1234):'); if(!p) return; localStorage.setItem(PIN_KEY,p);
      }
      paint();
    };
  }

  /* ---------------- Import ---------------- */
  async function handleImport(files){
    if(!files?.length) return;
    const cur = store.load();
    const map = new Map(cur.map(r=>[r.area+'|'+r.channel+'|'+r.date, r]));
    for(const f of files){
      try{
        const obj = JSON.parse(await f.text());
        const rec = normalizeRecord(obj);
        map.set(rec.area+'|'+rec.channel+'|'+rec.date, rec);
      }catch(e){ console.error(e); alert('Errore file: '+f.name); }
    }
    const merged = Array.from(map.values()).sort((a,b)=>new Date(a.date)-new Date(b.date));
    store.save(merged); render();
  }

  function normalizeRecord(o){
    const r = {
      area:    o.area || o.Area || '',
      channel: o.channel || o.CH || o.ch || '',
      date:    o.date || o.timestamp || new Date().toISOString(),
      points:  o.points || o.kpi || {}
    };
    r.points = {
      s1:Number(r.points.s1 || r.points.S1 || r.points['1S'] || 0),
      s2:Number(r.points.s2 || r.points.S2 || r.points['2S'] || 0),
      s3:Number(r.points.s3 || r.points.S3 || r.points['3S'] || 0),
      s4:Number(r.points.s4 || r.points.S4 || r.points['4S'] || 0),
      s5:Number(r.points.s5 || r.points.S5 || r.points['5S'] || 0)
    };
    // notes (lasciamo invariato: la tua pagina note già va bene)
    r.notes = Array.isArray(o.notes)? o.notes : [];
    return r;
  }

  /* ---------------- HOME ---------------- */
  function renderDelay(){
    const box = $('#delay-section'); if(!box) return;
    const ul = $('#delay-list');     if(!ul)  return;

    const today = Date.now();
    const late = [];
    for(const r of store.load()){
      const days = Math.floor((today - new Date(r.date).getTime())/86400000);
      if (days > 7){
        late.push({ch:r.channel, area:r.area, date:r.date, days});
      }
    }
    // tieni ultimo per CH/area
    const key = new Map();
    for(const row of late){
      key.set(row.area+'|'+row.ch, row);
    }
    const items = Array.from(key.values()).sort((a,b)=>b.days-a.days);

    ul.innerHTML = '';
    if(!items.length){ box.hidden = true; return; }
    box.hidden = false;

    for(const it of items){
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${it.ch}</strong> — <span class="chip">${it.area}</span>
        — <span class="muted">${it.days} giorni di ritardo</span>
        <button class="btn small tiny" data-ch="${encodeURIComponent(it.ch)}" data-date="${it.date}">Vedi note</button>
      `;
      ul.appendChild(li);
    }
    // linka a notes con highlight persistente via query
    ul.querySelectorAll('button.tiny').forEach(b=>{
      b.onclick = () => {
        const ch = b.dataset.ch;
        const d  = b.dataset.date;
        location.href = `notes.html?hlCh=${ch}&hlDate=${encodeURIComponent(d)}`;
      };
    });
  }

  function renderHome(){
    const wrap = $('#board-all'); if(!wrap) return;

    const type = $('.segmented .seg.on')?.dataset.type || 'all';
    const data = store.load().filter(r => type==='all' ? true : r.area===type);

    // group per CH e prendi l'ultimo record
    const byCh = new Map();
    for(const r of data){
      const k = r.channel||'CH ?';
      (byCh.get(k) || byCh.set(k,[]).get(k)).push(r);
    }

    wrap.innerHTML = '';
    const chips = $('#chip-strip'); if(chips) chips.innerHTML='';

    for(const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('div');
      card.className = 'board';
      card.innerHTML = `
        <h4>${ch} <span class="muted">${last?.area||''}</span></h4>
        <div class="hbars">
          <div class="hbar"><i class="l1" style="width:${p.s1}%"></i><span class="pct">1S ${pct(p.s1)}</span></div>
          <div class="hbar"><i class="l2" style="width:${p.s2}%"></i><span class="pct">2S ${pct(p.s2)}</span></div>
          <div class="hbar"><i class="l3" style="width:${p.s3}%"></i><span class="pct">3S ${pct(p.s3)}</span></div>
          <div class="hbar"><i class="l4" style="width:${p.s4}%"></i><span class="pct">4S ${pct(p.s4)}</span></div>
          <div class="hbar"><i class="l5" style="width:${p.s5}%"></i><span class="pct">5S ${pct(p.s5)}</span></div>
        </div>`;
      wrap.appendChild(card);

      const chip = document.createElement('button');
      chip.className='chip';
      chip.textContent = ch;
      chip.onclick = ()=> location.href='checklist.html#'+encodeURIComponent(ch);
      chips?.appendChild(chip);
    }

    $$('.segmented .seg').forEach(b=>{
      b.onclick = ()=>{ $$('.segmented .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderHome(); };
    });
  }

  /* ---------------- CHECKLIST ---------------- */
  function printCard(card){
    const w = window.open('','_blank');
    w.document.write(`<title>Stampa CH</title><style>
      body{font-family:Arial,sans-serif;margin:20px}
      .pill{display:inline-block;margin-right:6px;padding:4px 8px;border-radius:12px;color:#fff;font-weight:bold}
      .s1{background:${getCSS('--s1')}} .s2{background:${getCSS('--s2')}} .s3{background:${getCSS('--s3')}}
      .s4{background:${getCSS('--s4')}} .s5{background:${getCSS('--s5')}}
      .bar{height:14px;border-radius:7px;background:#eee;margin:10px 0;position:relative}
      .bar i{position:absolute;left:0;top:0;height:100%;border-radius:7px}
    </style>`);
    w.document.write(card.innerHTML.replaceAll('bars','').replaceAll('bar','bar'));
    w.document.close(); w.focus(); w.print(); setTimeout(()=>w.close(),100);
  }
  const getCSS = (v)=> getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function renderChecklist(){
    const wrap = $('#cards'); if(!wrap) return;
    const data = store.load();
    const hash = decodeURIComponent(location.hash.slice(1) || '');

    // group per CH
    const byCh = new Map();
    for(const r of data){
      const k = r.channel || 'CH ?';
      (byCh.get(k) || byCh.set(k,[]).get(k)).push(r);
    }

    wrap.innerHTML='';
    for(const [ch, arr] of Array.from(byCh.entries()).sort()){
      if(hash && ch !== hash) continue;

      const last = arr.sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p    = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('article');
      card.className='card-line';
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${ch.replace(/^CH\s*/,'')}</div>
            <div class="muted" style="font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${pct(p.s1)}</span>
            <span class="pill s2">S2 ${pct(p.s2)}</span>
            <span class="pill s3">S3 ${pct(p.s3)}</span>
            <span class="pill s4">S4 ${pct(p.s4)}</span>
            <span class="pill s5">S5 ${pct(p.s5)}</span>
            <span class="pill" style="background:#eef5ff;color:#0b3b8f">Voto medio ${pct(mean(p))}</span>
          </div>
          <div class="row-actions">
            <button class="btn outline dark btn-print">Stampa PDF</button>
            <button class="btn outline dark btn-toggle">Comprimi</button>
          </div>
        </div>
        <div class="bars">
          <div class="bar"><i class="l1" style="width:${p.s1}%"></i></div>
          <div class="bar"><i class="l2" style="width:${p.s2}%"></i></div>
          <div class="bar"><i class="l3" style="width:${p.s3}%"></i></div>
          <div class="bar"><i class="l4" style="width:${p.s4}%"></i></div>
          <div class="bar"><i class="l5" style="width:${p.s5}%"></i></div>
        </div>`;
      wrap.appendChild(card);

      card.querySelector('.btn-print').onclick  = () => printCard(card);
      card.querySelector('.btn-toggle').onclick = (e) => {
        card.classList.toggle('compact');
        e.target.textContent = card.classList.contains('compact') ? 'Espandi' : 'Comprimi';
      };
    }

    // Toggle globale
    const toggleAll = $('#btn-toggle-all');
    if(toggleAll){
      let compact=false;
      toggleAll.onclick = ()=>{
        compact=!compact;
        $$('.card-line').forEach(c=>c.classList.toggle('compact', compact));
        toggleAll.textContent = compact ? 'Espandi tutti i CH' : 'Comprimi / Espandi tutti i CH';
        $$('.card-line .btn-toggle').forEach(b=> b.textContent = compact ? 'Espandi' : 'Comprimi');
      };
    }

    $('#btn-print-all')?.addEventListener('click', ()=>window.print());
  }

  /* ---------------- NOTES (lasciata com’è) ---------------- */
  function renderNotes(){
    // la tua pagina note è ok: non modifichiamo nulla qui per non toccarla
    // solo: se arriva hlCh/hlDate in query, lasciamo l’highlight persistente via CSS
    const box = document.getElementById('notes-list');
    if (!box) return;
  }

  /* ---------------- Bind comuni + boot ---------------- */
  function initCommon(){
    $('#btn-import')?.addEventListener('click', ()=>$('#import-input')?.click());
    $('#import-input')?.addEventListener('change', e=>handleImport(e.target.files));
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);
  }

  function render(){
    renderDelay();
    renderHome();
    renderChecklist();
    renderNotes();
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    initCommon();
    initLock();
    render();
  });
})();
