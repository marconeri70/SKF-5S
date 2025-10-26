// SKF 5S Supervisor — build 2.3.12-full
// Base: tua versione stabile (main 2) + FIX NOTE (supporto oggetto/array) + nessun cambiamento grafico extra.

// ===================================
// Utility DOM
// ===================================
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ===================================
  // Storage
  // ===================================
  const store = {
    load(){
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn('[store.load]', e); return []; }
    },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // ===================================
  // Helpers
  // ===================================
  const fmtPercent = v => `${Math.round(Number(v)||0)}%`;
  const mean = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);

  // ===================================
  // NOTE: parser robusto
  // - notes array: [{s|S|type, text|note, date?}, ...]
  // - notes oggetto: {s1:"riga1\nriga2", s2:"...", ...} o {s1:[...]}
  // - fallback: se il file avesse S1..S5 come array di stringhe fuori da "notes"
  // ===================================
  function parseNotesFlexible(src, fallbackDate){
    const out = [];
    if (!src) return out;

    // Caso A: array
    if (Array.isArray(src)){
      for (const n of src){
        if (!n) continue;
        out.push({
          s:    n.s || n.S || n.type || '',
          text: n.text || n.note || '',
          date: n.date || fallbackDate
        });
      }
      return out;
    }

    // Caso B: oggetto {s1:"...", s2:"..."} con \n o array
    if (typeof src === 'object'){
      for (const k of Object.keys(src)){
        const val = src[k];
        if (typeof val === 'string' && val.trim()){
          for (const line of val.split(/\n+/)){
            const t = line.trim();
            if (t) out.push({ s:k, text:t, date:fallbackDate });
          }
        } else if (Array.isArray(val)){
          for (const line of val){
            const t = String(line||'').trim();
            if (t) out.push({ s:k, text:t, date:fallbackDate });
          }
        }
      }
      return out;
    }

    return out;
  }

  // ===================================
  // Record parser flessibile (non cambia i tuoi campi)
  // ===================================
  function parseRec(obj){
    const rec = {
      area:    obj.area || '',
      channel: obj.channel || obj.CH || obj.ch || '',
      date:    obj.date || obj.timestamp || new Date().toISOString(),
      points:  obj.points || obj.kpi || {},
      notes:   []
    };
    rec.points = {
      s1: Number(rec.points.s1 || rec.points.S1 || rec.points['1S'] || 0),
      s2: Number(rec.points.s2 || rec.points.S2 || rec.points['2S'] || 0),
      s3: Number(rec.points.s3 || rec.points.S3 || rec.points['3S'] || 0),
      s4: Number(rec.points.s4 || rec.points.S4 || rec.points['4S'] || 0),
      s5: Number(rec.points.s5 || rec.points.S5 || rec.points['5S'] || 0)
    };

    // NOTE: unica modifica reale rispetto alla base — parser robusto
    rec.notes = parseNotesFlexible(obj.notes, rec.date);

    // Supporto extra: eventuali S1..S5 come array direttamente su root
    for (const k of Object.keys(obj||{})){
      if (/^S[1-5]$/i.test(k) && Array.isArray(obj[k])){
        for (const line of obj[k]){
          const t = String(line||'').trim();
          if (t) rec.notes.push({ s:k, text:t, date:rec.date });
        }
      }
    }

    return rec;
  }

  // ===================================
  // Import multiplo (invariato nei comportamenti)
  // ===================================
  async function handleImport(files){
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));

    for (const f of files){
      try{
        const txt = await f.text();
        const obj = JSON.parse(txt);
        const rec = parseRec(obj);
        if (!rec.channel) throw new Error('CH mancante');
        byKey.set(rec.area + '|' + rec.channel + '|' + rec.date, rec);
      }catch(e){
        console.error('[import]', f.name, e);
        alert('Errore file: ' + f.name);
      }
    }

    const merged = Array.from(byKey.values()).sort((a,b)=> new Date(a.date)-new Date(b.date));
    store.save(merged);
    render(); // aggiorna tutte le viste
  }

  // ===================================
  // Export con PIN (uguale alla tua logica)
  // ===================================
  function exportAll(){
    const pinSaved = localStorage.getItem(PIN_KEY);
    const ask = prompt('Inserisci PIN (demo 1234):', '');
    if ((pinSaved && ask !== pinSaved) || (!pinSaved && ask !== '1234')){
      alert('PIN errato'); return;
    }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // ===================================
  // PIN / Lucchetto (rispetta la tua UI)
  // ===================================
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
        const n2 = prompt('Conferma nuovo PIN:');     if (n2 !== n1){ alert('Non coincide'); return; }
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

  // ===================================
  // HOME — grafici orizzontali + filtro tipo (come tua base)
  // Richiede in index.html:
  //  - .segmented .seg[data-type] con class .on per attivo
  //  - #board-all come contenitore delle card dei CH
  //  - #chip-strip per i pulsanti CH
  // ===================================
  function renderHome(){
    const wrap = $('#board-all'); if (!wrap) return;
    const data = store.load();

    const activeType = $('.segmented .seg.on')?.dataset.type || 'all';
    const filt = (r) => activeType==='all' ? true : (r.area===activeType);

    // group per CH, prendi ultimo record
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
  
// ===================================
// HOME — controllo CH in ritardo
// ===================================
// ===================================
// HOME — controllo CH in ritardo (con link alle note evidenziate)
// ===================================
function renderDelays() {
  const delaySec  = document.getElementById('delay-section');
  const delayList = document.getElementById('delay-list');
  if (!delaySec || !delayList) return;

  const data = store.load();
  if (!data.length) { delaySec.hidden = true; return; }

  const today   = new Date();
  const maxDays = 7; // soglia

  // mappa CH -> ultimo record
  const lastByCh = new Map();
  for (const r of data) {
    const ch = r.channel || 'CH?';
    const d  = new Date(r.date);
    if (!lastByCh.has(ch) || d > new Date(lastByCh.get(ch).date)) {
      lastByCh.set(ch, r);
    }
  }

  const delayed = [];
  for (const [ch, rec] of lastByCh.entries()) {
    const d = new Date(rec.date);
    const diff = Math.floor((today - d) / 86400000);
    if (diff > maxDays) {
      delayed.push({
        ch,
        area: rec.area || '',
        days: diff,
        date: d.toISOString().split('T')[0],         // solo yyyy-mm-dd
        iso:  rec.date                                // ISO completo per match
      });
    }
  }

  if (!delayed.length) { delaySec.hidden = true; return; }

  delaySec.hidden = false;
  delayList.innerHTML = delayed
    .sort((a,b)=> b.days - a.days)
    .map(d => `
      <li class="delay-item">
        <strong>${d.ch}</strong>
        <span class="muted">— ${d.days} giorni di ritardo</span>
        <span class="small">(ultimo aggiornamento: ${d.date}${d.area ? ` • ${d.area}` : ''})</span>
        <button class="btn tiny outline"
          onclick="location.href='notes.html?hlCh=${encodeURIComponent(d.ch)}&hlDate=${encodeURIComponent(d.iso)}'">
          Vedi note
        </button>
      </li>
    `)
    .join('');
}

  // ===================================
  // CHECKLIST — card + comprimi/espandi + stampa singola
  // Richiede in checklist.html:
  //  - #cards
  //  - #btn-toggle-all (opzionale)
  //  - .btn-print su ogni card
  // ===================================
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
  const wrap = $('#cards'); 
  if (!wrap) return;

  const data = store.load();
  wrap.innerHTML = '';

  // hash facoltativo per aprire direttamente un CH (es. checklist.html#CH%2011)
  const hash = decodeURIComponent(location.hash.slice(1) || '');
  afterChecklistRender();

  // group per CH
  const byCh = new Map();
  for (const r of data){
    const key = r.channel || 'CH ?';
    (byCh.get(key) || byCh.set(key, []).get(key)).push(r);
  }

  // --- fallback: inietta il bottone "Comprimi/Espandi" accanto a "Stampa PDF"
//     anche se la card è stata creata con il vecchio markup
function injectPerCardToggle(){
  $$('.card-line').forEach(card => {
    const printBtn = card.querySelector('.btn-print');
    if (!printBtn) return;

    // se il toggle non c'è ancora, lo aggiungo subito dopo il bottone stampa
    if (!card.querySelector('.btn-toggle')) {
      const toggle = document.createElement('button');
      toggle.className = 'btn ghost btn-toggle';
      toggle.textContent = card.classList.contains('compact') ? 'Espandi' : 'Comprimi';
      printBtn.insertAdjacentElement('afterend', toggle);

      toggle.addEventListener('click', () => {
        const isCompact = card.classList.toggle('compact');
        toggle.textContent = isCompact ? 'Espandi' : 'Comprimi';
      });
    }
  });
}

// richiama il fallback ogni volta che renderizzi le card
function afterChecklistRender(){
  injectPerCardToggle();
}

  // ordina per nome CH
  for (const [ch, arr] of Array.from(byCh.entries()).sort()){
    if (hash && ch !== hash) continue;

    // ultimo record per CH
    const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
    const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

    // ✨ etichetta senza doppio "CH"
    const label = 'CH ' + String(ch).replace(/^CH\s*/i,'').trim();

    // card
    const card = document.createElement('article');
    card.className = 'card-line';
    card.id = `CH-${CSS.escape(ch)}`;
    card.innerHTML = `
      <div class="top">
        <div>
          <div style="font-weight:800">${label}</div>
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

        <div class="btns">
          <button class="btn outline btn-print">Stampa PDF</button>
          <button class="btn ghost btn-toggle">Comprimi</button>
        </div>
      </div>

      <div class="bars">
        <div class="bar"><i class="l1" style="width:${p.s1}%"></i></div>
        <div class="bar"><i class="l2" style="width:${p.s2}%"></i></div>
        <div class="bar"><i class="l3" style="width:${p.s3}%"></i></div>
        <div class="bar"><i class="l4" style="width:${p.s4}%"></i></div>
        <div class="bar"><i class="l5" style="width:${p.s5}%"></i></div>
      </div>
    `;
    wrap.appendChild(card);

    // stampa solo questa card
    card.querySelector('.btn-print').onclick = () => printCard(card);

    // 🆕 toggle solo questa card
    const btnToggle = card.querySelector('.btn-toggle');
    btnToggle.addEventListener('click', () => {
      const isCompact = card.classList.toggle('compact');
      btnToggle.textContent = isCompact ? 'Espandi' : 'Comprimi';
    });
  }

  // toggle globale già esistente (se presente in pagina)
  const btnAll = $('#btn-toggle-all');
  if (btnAll){
    let compactAll = false;
    btnAll.onclick = () => {
      compactAll = !compactAll;
      $$('.card-line').forEach(c => c.classList.toggle('compact', compactAll));
      // aggiorna tutti i bottoni locali coerentemente
      $$('.card-line .btn-toggle').forEach(b => b.textContent = compactAll ? 'Espandi' : 'Comprimi');
    };
  }

  // stampa tutti (se presente)
  $('#btn-print-all')?.addEventListener('click', () => window.print());
}

  // ===================================
  // NOTE — elenco + filtri (usa i tuoi id presenti in notes.html)
  //  - #notes-list
  //  - #f-type (select con all/Rettifica/MONTAGGIO)
  //  - #f-from, #f-to (date)
  //  - #f-ch (text)
  //  - #notes-count, #notes-counter (opzionali)
  // ===================================
  // NOTE — elenco raggruppato: una card per CH (area) e data
function renderNotes(){
  const box = document.querySelector('#notes-list');
  if (!box) return;

  // ---- leggi filtri (compatibile con la tua UI attuale)
  const typeVal = (document.querySelector('#f-type')?.value || 'all');           // all | Rettifica | MONTAGGIO
  const fromVal = (document.querySelector('#f-from')?.value || '');              // yyyy-mm-dd
  const toVal   = (document.querySelector('#f-to')?.value   || '');              // yyyy-mm-dd
  const chVal   = (document.querySelector('#f-ch')?.value   || '').trim().toLowerCase();

  const inRange = (d) => {
    const t = new Date(d).getTime();
    if (fromVal && t < new Date(fromVal).getTime()) return false;
    if (toVal   && t > new Date(toVal).getTime() + 86400000 - 1) return false;
    return true;
  };
  const sKey = (s) => {
    // normalizza "s", "S", "1S", "S1", ecc. -> "S1".."S5"
    const m = String(s||'').match(/[1-5]/);
    return m ? ('S' + m[0]) : 'S1';
  };

  // ---- costruisci gruppi: (area|CH|data) -> { area, ch, date, byS: { S1:[...], ... } }
  const groups = new Map();
  for (const r of store.load()){
    if (typeVal !== 'all' && r.area !== typeVal) continue;
    if (chVal && String(r.channel).toLowerCase().indexOf(chVal) === -1) continue;

    const baseDate = r.date || new Date().toISOString();
    for (const n of (r.notes || [])){
      const noteDate = n.date || baseDate;
      if (!inRange(noteDate)) continue;

      const key = `${r.area}|${r.channel}|${noteDate}`;
      if (!groups.has(key)){
        groups.set(key, { area: r.area, ch: r.channel, date: noteDate, byS: { S1:[], S2:[], S3:[], S4:[], S5:[] } });
      }
      const g = groups.get(key);
      g.byS[sKey(n.s)].push(String(n.text||'').trim());
    }
  }

  // ---- ordina gruppi (più recenti in alto)
  const list = Array.from(groups.values()).sort((a,b)=> new Date(b.date) - new Date(a.date));

  // ---- contatori
  const totalNotes = list.reduce((acc,g)=> acc + Object.values(g.byS).reduce((s,arr)=> s+arr.length, 0), 0);
  const cnt1 = document.querySelector('#notes-count');
  const cnt2 = document.querySelector('#notes-counter');
  if (cnt1) cnt1.textContent = `(${totalNotes})`;
  if (cnt2) cnt2.textContent = `${totalNotes} note`;

  // ---- render
  box.innerHTML = '';
  if (!list.length){
    box.innerHTML = '<div class="muted">Nessuna nota con i filtri selezionati.</div>';
    return;
  }

  for (const g of list){
    const card = document.createElement('article');
    card.className = 'note grouped';

    // header card
    card.innerHTML = `
      <div class="note-head">
        <div class="left">
          <strong>${g.ch}</strong>
          <span class="chip">${g.area||''}</span>
        </div>
        <div class="muted">${g.date}</div>
      </div>
    `;

    // blocchi S1..S5 (solo quelli presenti)
    const wrap = document.createElement('div');
    wrap.className = 'swrap';
    (['S1','S2','S3','S4','S5']).forEach((S,i)=>{
      const arr = g.byS[S] || [];
      if (!arr.length) return;
      const blk = document.createElement('div');
      blk.className = 'sblock';
      blk.innerHTML = `
        <div class="sblock-head">
          <span class="pill s${i+1}">${S}</span>
        </div>
        <ul class="sitems">
          ${arr.map(t => `<li>${t.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</li>`).join('')}
        </ul>
      `;
      wrap.appendChild(blk);
    });
    card.appendChild(wrap);
    box.appendChild(card);
  }
}

  // ===================================
  // Bind comuni (rispetta la tua UI/ID)
  // ===================================
  function initCommon(){
    // Import multiplo
    $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', (e) => handleImport(e.target.files));

    // Export (PIN)
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);

    // Note
// Note: se siamo in home -> vai su notes.html; se già su notes -> ricalcola elenco
$('#btn-notes')?.addEventListener('click', (e) => {
  const page = document.body.getAttribute('data-page'); // "home" | "notes" | "checklist" ...
  if (page !== 'notes') {
    e?.preventDefault?.();
    location.href = 'notes.html';
  } else {
    renderNotes(); // già nella pagina note: aggiorna subito la lista
  }
});

    // Filtri note
    $('#f-apply')?.addEventListener('click', renderNotes);
    $('#f-clear')?.addEventListener('click', () => {
      if ($('#f-type')) $('#f-type').value = 'all';
      if ($('#f-from')) $('#f-from').value = '';
      if ($('#f-to'))   $('#f-to').value   = '';
      if ($('#f-ch'))   $('#f-ch').value   = '';
      renderNotes();
    });
  }

  // ===================================
  // Render dispatcher
  // ===================================
  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // ===================================
  // Boot
  // ===================================
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();
    renderDelays();

    // Registrazione SW: usa il tuo sw.js già presente (non forzo network-first qui)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('[SW register]', err));
    }
  });
})();
