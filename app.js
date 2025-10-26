// SKF 5S Supervisor — single JS per tutte le pagine
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY = 'skf5s:pin';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---- Store
  const store = {
    load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
            catch(e){ console.warn(e); return []; } },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // ---- Helpers
  const fmtPercent = v => `${Math.round(v)}%`;
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

  function parseRec(obj){
    // accetto vari schemi ma cerco sempre: area, channel, date, points{s1..s5}, notes[]
    const r = { area: obj.area || '', channel: obj.channel || obj.CH || obj.ch || '',
                date: obj.date || obj.timestamp || new Date().toISOString(),
                points: obj.points || obj.kpi || {} , notes: obj.notes || obj.note || [] };
    // normalizza s1..s5
    r.points = {
      s1: Number(r.points.s1 || r.points.S1 || r.points['1S'] || 0),
      s2: Number(r.points.s2 || r.points.S2 || r.points['2S'] || 0),
      s3: Number(r.points.s3 || r.points.S3 || r.points['3S'] || 0),
      s4: Number(r.points.s4 || r.points.S4 || r.points['4S'] || 0),
      s5: Number(r.points.s5 || r.points.S5 || r.points['5S'] || 0)
    };
    // normalizza note (array di oggetti {s,text,date})
    if (!Array.isArray(r.notes)) r.notes = [];
    r.notes = r.notes.map(n => ({
      s: (n.s || n.S || n.type || '').toString(),
      text: n.text || n.note || '',
      date: n.date || r.date
    }));
    return r;
  }

  // ---- Import
  async function handleImport(files){
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));

    for (const f of files){
      try{
        const text = await f.text();
        const obj = JSON.parse(text);
        const rec = parseRec(obj);
        if (!rec.channel) throw new Error('CH mancante');
        byKey.set(rec.area + '|' + rec.channel + '|' + rec.date, rec);
      }catch(e){
        alert('File non valido: ' + f.name);
      }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=> new Date(a.date)-new Date(b.date));
    store.save(merged);
    render(); // aggiorna tutto
  }

  // ---- Export protetto
  function exportAll(){
    const pin = localStorage.getItem(PIN_KEY);
    const ask = prompt('Inserisci PIN (demo 1234):', '');
    if ((pin && ask !== pin) || (!pin && ask !== '1234')){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(),null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // ---- PIN / Lucchetto (set/modify)
  function initLock(){
    const btn = $('#btn-lock'); if (!btn) return;
    const paint = () => {
      const pin = localStorage.getItem(PIN_KEY);
      btn.textContent = pin ? '🔓' : '🔒';
      btn.title = pin ? 'PIN impostato — clic per modificare' : 'Imposta PIN';
    };
    paint();
    btn.onclick = () => {
      const old = localStorage.getItem(PIN_KEY);
      if (old){
        const chk = prompt('Inserisci PIN attuale:'); if (chk !== old){ alert('PIN errato'); return; }
        const n1 = prompt('Nuovo PIN (4-10 cifre):'); if (!n1) return;
        const n2 = prompt('Conferma nuovo PIN:'); if (n2 !== n1){ alert('Non coincide'); return; }
        localStorage.setItem(PIN_KEY, n1); alert('PIN aggiornato.'); paint();
      }else{
        const n1 = prompt('Imposta PIN (demo iniziale 1234):'); if (!n1) return;
        localStorage.setItem(PIN_KEY, n1); alert('PIN impostato.'); paint();
      }
    };
  }

  // ---- HOME: grafico orizzontale per tutti i CH con filtro tipo
  function renderHome(){
    const wrap = $('#board-all'); if (!wrap) return;
    const data = store.load();
    const typeBtn = $('.segmented'); // contiene i bottoni tipo
    const activeType = typeBtn ? typeBtn.querySelector('.seg.on')?.dataset.type : 'all';
    const typeFilter = (r) => (activeType === 'all') ? true : (r.area === activeType);

    // raggruppa per CH (ultimo record per CH)
    const byCh = new Map();
    for (const r of data.filter(typeFilter)){
      const k = r.channel;
      const arr = byCh.get(k) || [];
      arr.push(r); byCh.set(k, arr);
    }

    wrap.innerHTML = '';
    const chips = $('#chip-strip'); if (chips) chips.innerHTML = '';

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      // card CH
      const card = document.createElement('div');
      card.className = 'board';
      card.innerHTML = `<h4>${ch} <small class="muted">${last?.area||''}</small></h4>
        <div class="hbars">
          <div class="hbar"><i class="l1" style="width:${p.s1}%"></i><span class="pct">1S ${fmtPercent(p.s1)}</span></div>
          <div class="hbar"><i class="l2" style="width:${p.s2}%"></i><span class="pct">2S ${fmtPercent(p.s2)}</span></div>
          <div class="hbar"><i class="l3" style="width:${p.s3}%"></i><span class="pct">3S ${fmtPercent(p.s3)}</span></div>
          <div class="hbar"><i class="l4" style="width:${p.s4}%"></i><span class="pct">4S ${fmtPercent(p.s4)}</span></div>
          <div class="hbar"><i class="l5" style="width:${p.s5}%"></i><span class="pct">5S ${fmtPercent(p.s5)}</span></div>
        </div>`;
      wrap.appendChild(card);

      // chip per salto scheda
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      $('#chip-strip')?.appendChild(chip);
    }

    // toggle tipo
    $$('.segmented .seg').forEach(b=>{
      b.onclick = () => { $$('.segmented .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderHome(); };
    });
  }

  // ---- CHECKLIST: cards per CH
  function renderChecklist(){
    const wrap = $('#cards'); if (!wrap) return;
    const data = store.load();
    const byCh = new Map();
    for (const r of data){ const k = r.channel || 'CH?'; (byCh.get(k) || byCh.set(k,[]).get(k)).push(r); }

    wrap.innerHTML = '';
    const targetHash = decodeURIComponent(location.hash.slice(1) || '');

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const card = document.createElement('article');
      card.className = 'card-line';
      card.id = `CH-${CSS.escape(ch)}`;
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${ch.replace(/^CH\s*/,'')}</div>
            <div class="muted" style="font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${p.s1}%</span>
            <span class="pill s2">S2 ${p.s2}%</span>
            <span class="pill s3">S3 ${p.s3}%</span>
            <span class="pill s4">S4 ${p.s4}%</span>
            <span class="pill s5">S5 ${p.s5}%</span>
            <span class="pill" style="background:#eef5ff;color:#0b3b8f">Voto medio ${Math.round(avg([p.s1,p.s2,p.s3,p.s4,p.s5]))}%</span>
          </div>
          <div><button class="btn outline btn-print">Stampa PDF</button></div>
        </div>
        <div class="hbars" style="margin-top:.7rem">
          <div class="hbar"><i class="l1" style="width:${p.s1}%"></i></div>
          <div class="hbar"><i class="l2" style="width:${p.s2}%"></i></div>
          <div class="hbar"><i class="l3" style="width:${p.s3}%"></i></div>
          <div class="hbar"><i class="l4" style="width:${p.s4}%"></i></div>
          <div class="hbar"><i class="l5" style="width:${p.s5}%"></i></div>
        </div>
      `;
      wrap.appendChild(card);

      // stampa singola card
      card.querySelector('.btn-print').onclick = () => {
        const w = window.open('', '_blank');
        w.document.write(`<title>${ch} — SKF 5S</title><style>
          body{font-family:Arial,sans-serif;margin:20px}
          .pill{display:inline-block;margin-right:6px;padding:4px 8px;border-radius:12px;color:#fff;font-weight:bold}
          .s1{background:${getComputedStyle(document.documentElement).getPropertyValue('--s1')}} 
          .s2{background:${getComputedStyle(document.documentElement).getPropertyValue('--s2')}}
          .s3{background:${getComputedStyle(document.documentElement).getPropertyValue('--s3')}}
          .s4{background:${getComputedStyle(document.documentElement).getPropertyValue('--s4')}}
          .s5{background:${getComputedStyle(document.documentElement).getPropertyValue('--s5')}}
          .bar{height:14px;border-radius:7px;background:#eee;margin:10px 0;position:relative}
          .bar i{position:absolute;left:0;top:0;height:100%;border-radius:7px}
        </style>`);
        w.document.write(card.innerHTML.replaceAll('hbars','').replaceAll('hbar','bar'));
        w.document.close(); w.focus(); w.print(); setTimeout(()=>w.close(),100);
      };
    }

    // tasto “Comprimi / Espandi tutti i CH” => aggiunge/rimuove class compact
    const toggleAll = $('#btn-toggle-all');
    if (toggleAll){
      let compact = false;
      toggleAll.onclick = () => {
        compact = !compact;
        $$('.card-line').forEach(c => c.classList.toggle('compact', compact));
      };
    }

    // tasto “Stampa tutti i CH”: usa la finestra di stampa del browser
    $('#btn-print-all')?.addEventListener('click', () => window.print());

    // focus al CH richiesto via hash
    if (targetHash){
      const t = document.getElementById(`CH-${CSS.escape(targetHash)}`);
      if (t) t.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }

  // ---- NOTE con filtri (tipo, data, CH)
  function renderNotes(){
    const box = $('#notes-list'); if (!box) return;
    const all = store.load();
    // flatten
    const rows = [];
    for (const r of all){
      for (const n of (r.notes||[])){
        rows.push({ ch:r.channel, area:r.area, s:n.s, text:n.text, date:n.date });
      }
    }
    const count = $('#notes-count');

    const typeVal = $('#f-type')?.value || 'all';
    const fromVal = $('#f-from')?.value || '';
    const toVal = $('#f-to')?.value || '';
    const chVal = ($('#f-ch')?.value || '').trim();

    const inRange = (d) => {
      const t = new Date(d).getTime();
      if (fromVal && t < new Date(fromVal).getTime()) return false;
      if (toVal && t > new Date(toVal).getTime()+86400000-1) return false;
      return true;
    };

    const list = rows
      .filter(r => (typeVal==='all' ? true : r.area===typeVal))
      .filter(r => !chVal ? true : ((''+r.ch).toLowerCase().includes(chVal.toLowerCase())))
      .filter(r => inRange(r.date))
      .sort((a,b)=> new Date(b.date)-new Date(a.date));

    box.innerHTML = '';
    if (count) count.textContent = `(${list.length})`;
    if (!list.length){ box.innerHTML = '<div class="muted">Nessuna nota con i filtri selezionati.</div>'; return; }

    for (const n of list){
      const el = document.createElement('div');
      el.className = 'note';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> • <span class="pill s${(n.s||'1')[0]}">S${(n.s||'1')[0]}</span> <span class="chip">${n.area||''}</span></div>
          <div class="muted">${n.date}</div>
        </div>
        <div style="margin-top:.45rem;white-space:pre-wrap">${n.text}</div>`;
      box.appendChild(el);
    }
  }

  // ---- Common wiring
  function initCommon(){
    $('#btn-import')?.addEventListener('click', ()=> $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', e => handleImport(e.target.files));
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);
    $('#btn-notes')?.addEventListener('click', ()=> location.href='notes.html');

    // note filters
    $('#f-apply')?.addEventListener('click', renderNotes);
    $('#f-clear')?.addEventListener('click', ()=>{ $('#f-type').value='all'; $('#f-from').value=''; $('#f-to').value=''; $('#f-ch').value=''; renderNotes(); });
  }

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // ---- bootstrap
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  });
})();
