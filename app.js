// SKF 5S Supervisor — build 2.3.11 (tema chiaro, SW network-first)
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY = 'skf5s:pin';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const store = {
    load(){
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn('[store.load]', e); return []; }
    },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  const fmtPercent = v => `${Math.round(Number(v)||0)}%`;
  const mean = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);

  // ---------- Parser robusto (accetta vari schemi)
  function parseRec(obj){
    const rec = {
      area: obj.area || '',
      channel: obj.channel || obj.CH || obj.ch || '',
      date: obj.date || obj.timestamp || new Date().toISOString(),
      points: obj.points || obj.kpi || {},
      notes: []
    };

    rec.points = {
      s1: Number(rec.points.s1 || rec.points.S1 || rec.points['1S'] || 0),
      s2: Number(rec.points.s2 || rec.points.S2 || rec.points['2S'] || 0),
      s3: Number(rec.points.s3 || rec.points.S3 || rec.points['3S'] || 0),
      s4: Number(rec.points.s4 || rec.points.S4 || rec.points['4S'] || 0),
      s5: Number(rec.points.s5 || rec.points.S5 || rec.points['5S'] || 0)
    };

    // notes come array standard
    if (Array.isArray(obj.notes)){
      rec.notes = obj.notes.map(n => ({
        s: n.s || n.S || n.type || '',
        text: n.text || n.note || '',
        date: n.date || rec.date
      }));
    }
    // notes come oggetto {s1:"...", s2:"..."} -> split per riga
    else if (obj.notes && typeof obj.notes === 'object'){
      for (const k of Object.keys(obj.notes)){
        const val = obj.notes[k];
        if (typeof val === 'string' && val.trim()){
          for (const line of val.split(/\n+/)){
            const t = line.trim();
            if (t) rec.notes.push({ s:k, text:t, date:rec.date });
          }
        }
      }
    }
    // fallback: chiavi S1..S5 come array di stringhe
    else {
      for (const k of Object.keys(obj)){
        if (/^S[1-5]$/i.test(k) && Array.isArray(obj[k])){
          for (const line of obj[k]){
            if (typeof line === 'string' && line.trim()){
              rec.notes.push({ s:k, text:line.trim(), date:rec.date });
            }
          }
        }
      }
    }

    return rec;
  }

  // ---------- Import multiplo
  async function handleImport(files){
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));

    for (const f of files){
      try{
        const txt = await f.text();
        const obj = JSON.parse(txt);
        const rec = parseRec(obj);
        if (!rec.channel) throw new Error('CH mancante nel file');
        byKey.set(rec.area + '|' + rec.channel + '|' + rec.date, rec);
      }catch(e){
        console.error('[import]', f.name, e);
        alert('Errore file: ' + f.name);
      }
    }

    const merged = Array
      .from(byKey.values())
      .sort((a,b)=> new Date(a.date) - new Date(b.date));

    store.save(merged);
    render(); // aggiorna tutte le pagine
  }

  // ---------- Export con PIN
  function exportAll(){
    const pinSaved = localStorage.getItem(PIN_KEY);
    const ask = prompt('Inserisci PIN (demo 1234):', '');
    if ((pinSaved && ask !== pinSaved) || (!pinSaved && ask !== '1234')){
      alert('PIN errato');
      return;
    }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // ---------- PIN / Lucchetto
  function initLock(){
    const btn = $('#btn-lock'); if (!btn) return;

    const paint = () => {
      const pin = localStorage.getItem(PIN_KEY);
      btn.textContent = pin ? '🔓' : '🔒';
      btn.title = pin ? 'PIN impostato — clic per cambiare' : 'Imposta PIN';
    };
    paint();

    btn.onclick = () => {
      const old = localStorage.getItem(PIN_KEY);
      if (old){
        const chk = prompt('Inserisci PIN attuale:');
        if (chk !== old){ alert('PIN errato'); return; }
        const n1 = prompt('Nuovo PIN (4-10 cifre):'); if (!n1) return;
        const n2 = prompt('Conferma nuovo PIN:');  if (n2 !== n1){ alert('Non coincide'); return; }
        localStorage.setItem(PIN_KEY, n1);
        alert('PIN aggiornato.');
        paint();
      } else {
        const n1 = prompt('Imposta PIN (demo 1234):'); if (!n1) return;
        localStorage.setItem(PIN_KEY, n1);
        paint();
      }
    };
  }

  // ---------- HOME (grafici orizzontali + filtro tipo)
  function renderHome(){
    const wrap = $('#board-all'); if (!wrap) return;
    const data = store.load();
    const activeType = $('.segmented .seg.on')?.dataset.type || 'all';
    const filt = (r) => activeType==='all' ? true : (r.area===activeType);

    // Group per CH e prendi l’ultimo
    const byCh = new Map();
    for (const r of data.filter(filt)){
      const k = r.channel || 'CH?';
      (byCh.get(k) || byCh.set(k, []).get(k)).push(r);
    }

    wrap.innerHTML = '';
    const chips = $('#chip-strip'); if (chips) chips.innerHTML = '';

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('div');
      card.className = 'board';
      card.innerHTML = `
        <h4>${ch} <small class="muted">${last?.area||''}</small></h4>
        <div class="hbars">
          <div class="hbar"><i class="l1" style="width:${p.s1}%"></i><span class="pct">1S ${fmtPercent(p.s1)}</span></div>
          <div class="hbar"><i class="l2" style="width:${p.s2}%"></i><span class="pct">2S ${fmtPercent(p.s2)}</span></div>
          <div class="hbar"><i class="l3" style="width:${p.s3}%"></i><span class="pct">3S ${fmtPercent(p.s3)}</span></div>
          <div class="hbar"><i class="l4" style="width:${p.s4}%"></i><span class="pct">4S ${fmtPercent(p.s4)}</span></div>
          <div class="hbar"><i class="l5" style="width:${p.s5}%"></i><span class="pct">5S ${fmtPercent(p.s5)}</span></div>
        </div>`;
      wrap.appendChild(card);

      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chips?.appendChild(chip);
    }

    // toggle tipo
    $$('.segmented .seg').forEach(b=>{
      b.onclick = () => { $$('.segmented .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderHome(); };
    });
  }

  // ---------- CHECKLIST (cards + comprimi/espandi + stampa singola)
  function printCard(card){
    const w = window.open('', '_blank');
    w.document.write(`<title>Stampa CH</title><style>
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
  }

  function renderChecklist(){
    const wrap = $('#cards'); if (!wrap) return;
    const data = store.load();
    wrap.innerHTML = '';

    // mantieni ultimo record per ogni CH; se #hash presente, filtra
    const hash = decodeURIComponent(location.hash.slice(1) || '');
    const byCh = new Map();
    for (const r of data){
      const key = r.channel || 'CH?';
      (byCh.get(key) || byCh.set(key, []).get(key)).push(r);
    }

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      if (hash && ch !== hash) continue;
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('article');
      card.className = 'card-line';
      card.id = `CH-${CSS.escape(ch)}`;
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${ch.replace(/^CH\\s*/,'')}</div>
            <div class="muted" style="font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${fmtPercent(p.s1)}</span>
            <span class="pill s2">S2 ${fmtPercent(p.s2)}</span>
            <span class="pill s3">S3 ${fmtPercent(p.s3)}</span>
            <span class="pill s4">S4 ${fmtPercent(p.s4)}</span>
            <span class="pill s5">S5 ${fmtPercent(p.s5)}</span>
            <span class="pill" style="background:#eef5ff;color:#0b3b8f">Voto medio ${fmtPercent(mean(p))}</span>
          </div>
          <div><button class="btn outline btn-print">Stampa PDF</button></div>
        </div>
        <div class="bars">
          <div class="bar"><i class="l1" style="width:${p.s1}%"></i></div>
          <div class="bar"><i class="l2" style="width:${p.s2}%"></i></div>
          <div class="bar"><i class="l3" style="width:${p.s3}%"></i></div>
          <div class="bar"><i class="l4" style="width:${p.s4}%"></i></div>
          <div class="bar"><i class="l5" style="width:${p.s5}%"></i></div>
        </div>`;
      wrap.appendChild(card);

      card.querySelector('.btn-print').onclick = () => printCard(card);
    }

    // Comprimi/Espandi tutte
    const toggleAll = $('#btn-toggle-all');
    if (toggleAll){
      let compact = false;
      toggleAll.onclick = () => {
        compact = !compact;
        $$('.card-line').forEach(c => c.classList.toggle('compact', compact));
      };
    }

    $('#btn-print-all')?.addEventListener('click', () => window.print());
  }

  // ---------- NOTE (elenco + filtri Tipo/Date/CH)
  function renderNotes(){
    const box = $('#notes-list'); if (!box) return;

    const rows = [];
    for (const r of store.load()){
      for (const n of (r.notes||[])){
        rows.push({
          ch: r.channel,
          area: r.area,
          s: n.s,
          text: n.text,
          date: n.date || r.date
        });
      }
    }

    const typeVal = $('#f-type')?.value || 'all';
    const fromVal = $('#f-from')?.value || '';
    const toVal   = $('#f-to')?.value   || '';
    const chVal   = ($('#f-ch')?.value || '').trim().toLowerCase();

    const inRange = (d) => {
      const t = new Date(d).getTime();
      if (fromVal && t < new Date(fromVal).getTime()) return false;
      if (toVal   && t > new Date(toVal).getTime()+86400000-1) return false;
      return true;
    };

    const list = rows
      .filter(r => (typeVal==='all' ? true : r.area===typeVal))
      .filter(r => (!chVal ? true : ((''+r.ch).toLowerCase().includes(chVal))))
      .filter(r => inRange(r.date))
      .sort((a,b)=> new Date(b.date) - new Date(a.date));

    box.innerHTML = '';
    $('#notes-count')?.textContent = `(${list.length})`;
    $('#notes-counter')?.textContent = `${list.length} note`;

    if (!list.length){
      box.innerHTML = '<div class="muted">Nessuna nota con i filtri selezionati.</div>';
      return;
    }

    for (const n of list){
      const el = document.createElement('div');
      const S = (n.s||'').toString().match(/[1-5]/)?.[0] || '1';
      el.className = 'note';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> • <span class="pill s${S}">S${S}</span> <span class="chip">${n.area||''}</span></div>
          <div class="muted">${n.date||''}</div>
        </div>
        <div style="margin-top:.45rem;white-space:pre-wrap">${n.text||''}</div>`;
      box.appendChild(el);
    }
  }

  // ---------- Bind comuni
  function initCommon(){
    $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', (e) => handleImport(e.target.files));
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);
    $('#btn-notes')?.addEventListener('click', () => location.href = 'notes.html');

    // filtri note
    $('#f-apply')?.addEventListener('click', renderNotes);
    $('#f-clear')?.addEventListener('click', () => {
      if ($('#f-type')) $('#f-type').value = 'all';
      if ($('#f-from')) $('#f-from').value = '';
      if ($('#f-to'))   $('#f-to').value   = '';
      if ($('#f-ch'))   $('#f-ch').value   = '';
      renderNotes();
    });
  }

  function render(){ renderHome(); renderChecklist(); renderNotes(); }

  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();

    // ---------- Registrazione SW (network-first) + update forzato
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        // Se c'è un SW in attesa, chiedi di attivarsi subito
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');

        // Se arriva un nuovo SW, appena entra in waiting, attivalo
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage('SKIP_WAITING');
            }
          });
        });

        // Quando cambia controller (nuovo SW attivo), ricarica la pagina
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      }).catch(err => console.warn('[SW register]', err));
    }
  });
})();
