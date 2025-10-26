// SKF 5S Supervisor — single JS for all pages
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';

  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // -----------------------------
  // Storage helper (localStorage)
  // -----------------------------
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn('load error', e); return []; }
    },
    save(arr) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }
  };

  // -----------------------------------
  // Utilities to normalise an import
  // -----------------------------------
  const toISODateOnly = (d) => {
    try { return (d || '').slice(0,10); } catch(e){ return ''; }
  };

  // Convert "notes" (object s1..s5 or array) -> array of note rows
  function normaliseNotes(rec){
    const rows = [];
    const pushBlock = (sKey, block, dateHint) => {
      if (!block) return;
      // split on newline preserving text
      const lines = String(block).split(/\r?\n/).filter(t => t.trim().length);
      for (const line of lines){
        rows.push({
          ch: rec.channel || '',
          area: rec.area || '',
          s: sKey.toUpperCase(),    // "S1" ... "S5"
          text: line.trim(),
          date: dateHint || rec.date || ''
        });
      }
    };

    // FORMAT A: object with s1..s5
    if (rec && rec.notes && !Array.isArray(rec.notes)) {
      const map = rec.notes;
      if (map.s1) pushBlock('S1', map.s1, toISODateOnly(rec?.dates?.s1));
      if (map.s2) pushBlock('S2', map.s2, toISODateOnly(rec?.dates?.s2));
      if (map.s3) pushBlock('S3', map.s3, toISODateOnly(rec?.dates?.s3));
      if (map.s4) pushBlock('S4', map.s4, toISODateOnly(rec?.dates?.s4));
      if (map.s5) pushBlock('S5', map.s5, toISODateOnly(rec?.dates?.s5));
    }

    // FORMAT B: array of {s,text,date}
    if (Array.isArray(rec?.notes)) {
      for (const n of rec.notes){
        if (!n) continue;
        rows.push({
          ch: rec.channel || '',
          area: rec.area || '',
          s: String(n.s || n.S || n.type || '').toUpperCase(),
          text: String(n.text || n.note || '').trim(),
          date: n.date || rec.date || ''
        });
      }
    }

    return rows;
  }

  // -----------------------------------
  // Import handler (multi-file + merge)
  // -----------------------------------
  async function handleImport(files) {
    if (!files || !files.length) return;

    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));

    let ok = 0, bad = 0;
    for (const f of files) {
      try {
        const text = await f.text();
        const rec = JSON.parse(text);

        // expected minimal shape:
        // { area, channel, date, points:{s1..s5}, notes: {s1..s5} | [] , dates? }
        if (!rec || !rec.area || !rec.channel || !rec.points) throw new Error('struttura non valida');

        // normalizza note per la pagina "Note"
        rec._notes = normaliseNotes(rec);       // array di righe pronte
        const k = rec.area + '|' + rec.channel + '|' + rec.date;
        byKey.set(k, rec);
        ok++;
      } catch (e) {
        console.warn('Import error for', f.name, e);
        bad++;
      }
    }

    const merged = Array.from(byKey.values()).sort((a,b)=> {
      const kc = String(a.channel||'').localeCompare(String(b.channel||''));
      if (kc) return kc;
      return new Date(a.date) - new Date(b.date);
    });

    store.save(merged);
    alert(`Import completato.\nAggiunti/Aggiornati: ${ok}\nScartati: ${bad}\nTotale archiviati: ${merged.length}`);

    // reset input per consentire un secondo import senza ricaricare la pagina
    const input = $('#import-input');
    if (input) input.value = '';

    // ridisegna le pagine attive
    render();
    paintNotesBadge();
  }

  // -----------------------------------
  // SMALL CHARTS
  // -----------------------------------
  function renderMiniBars(el, values, labels=['1S','2S','3S','4S','5S']){
    el.innerHTML = '';
    const max = Math.max(100, ...values);
    for (let i=0;i<labels.length;i++){
      const wrap = document.createElement('div');
      const percent = (values[i] || 0) / Math.max(100, ...values);
      bar.style.setProperty(`--p${i+1}`, String(percent));
      wrap.className = 'hbar';
      const bar = document.createElement('div');
      bar.style.width = Math.round((values[i]||0)/max*100) + '%';
      bar.className = `hbar-fill s${i+1}`;
      const lab = document.createElement('span');
      lab.className = 'hbar-lab';
      lab.textContent = labels[i];
      const val = document.createElement('span');
      val.className = 'hbar-val';
      val.textContent = `${values[i]||0}%`;
      wrap.appendChild(lab);
      wrap.appendChild(bar);
      wrap.appendChild(val);
      el.appendChild(wrap);
    }
  }

  // -----------------------------------
  // HOME (index)
  // -----------------------------------
  function renderHome() {
    const cont = $('#unifiedChart');
    const chips = $('#chip-strip');
    if (!cont || !chips) return;

    const data = store.load();
    cont.innerHTML = '';
    chips.innerHTML = '';

    // raggruppa per CH e prendi l'ultimo record per ciascuno
    const byCh = new Map();
    for (const r of data) {
      const key = r.channel || 'CH?';
      (byCh.get(key) || byCh.set(key, []).get(key)).push(r);
    }

    const ordered = Array.from(byCh.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));
    for (const [ch, arr] of ordered){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const card = document.createElement('div');
      card.className = 'unified';
      card.innerHTML = `
        <div class="unified-title">${ch} <span class="muted">${last?.area||''}</span></div>
        <div class="unified-bars"></div>`;
      cont.appendChild(card);

      const vals = [
        last?.points?.s1 ?? 0,
        last?.points?.s2 ?? 0,
        last?.points?.s3 ?? 0,
        last?.points?.s4 ?? 0,
        last?.points?.s5 ?? 0
      ];
      renderMiniBars(card.querySelector('.unified-bars'), vals);

      // chip per aprire checklist direttamente su quel CH
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chips.appendChild(chip);
    }
  }

  // -----------------------------------
  // CHECKLIST (lista CH con KPI)
  // -----------------------------------
  function renderChecklist() {
    const wrap = $('#cards');
    if (!wrap) return;

    const data = store.load();
    wrap.innerHTML = '';

    // group by channel
    const byCh = new Map();
    for (const r of data) {
      const key = r.channel || 'CH?';
      (byCh.get(key) || byCh.set(key, []).get(key)).push(r);
    }

    const ordered = Array.from(byCh.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));
    for (const [ch, arr] of ordered){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const k = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((k.s1+k.s2+k.s3+k.s4+k.s5)/5);
      const card = document.createElement('section');
      card.className = 'card ch-card';
      card.innerHTML = `
        <div class="ch-head">
          <div class="ch-name">${ch}</div>
          <div class="muted">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          <div class="kpis">
            <span class="pill s1">S1 ${k.s1}%</span>
            <span class="pill s2">S2 ${k.s2}%</span>
            <span class="pill s3">S3 ${k.s3}%</span>
            <span class="pill s4">S4 ${k.s4}%</span>
            <span class="pill s5">S5 ${k.s5}%</span>
            <span class="badge">Voto medio ${avg}%</span>
            <button class="btn outline" onclick="window.print()">Stampa PDF</button>
          </div>
        </div>
        <div class="bars"></div>
      `;
      wrap.appendChild(card);

      renderMiniBars(card.querySelector('.bars'), [k.s1,k.s2,k.s3,k.s4,k.s5]);
    }
  }

  // -----------------------------------
  // NOTE page (con filtri)
  // -----------------------------------
  function collectAllNotes(){
    const data = store.load();
    const out = [];
    for (const r of data) {
      const rows = Array.isArray(r._notes) ? r._notes : normaliseNotes(r);
      for (const n of rows) out.push(n);
    }
    return out;
  }

  function renderNotes(){
    const list = $('#notes-list');
    if (!list) return;

    // filtri UI
    const selCh = $('#filter-ch');
    const dFrom = $('#filter-from');
    const dTo   = $('#filter-to');
    const btnCl = $('#filter-clear');

    // popola select CH
    const chs = new Set(store.load().map(r => r.channel).filter(Boolean));
    if (selCh && !selCh._filled){
      selCh.innerHTML = '<option value="">Tutti</option>' +
        Array.from(chs).sort((a,b)=>String(a).localeCompare(String(b))).map(ch => `<option>${ch}</option>`).join('');
      selCh._filled = true;
    }

    const all = collectAllNotes()
      .sort((a,b)=> new Date(b.date)-new Date(a.date));

    function passFilters(n){
      const chOk = !selCh?.value || n.ch === selCh.value;
      const f = dFrom?.value ? new Date(dFrom.value) : null;
      const t = dTo?.value   ? new Date(dTo.value)   : null;
      const nd = n.date ? new Date(n.date) : null;
      const fromOk = !f || (nd && nd >= f);
      const toOk   = !t || (nd && nd <= t);
      return chOk && fromOk && toOk;
    }

    const rows = all.filter(passFilters);

    // badge count in header
    const badge = $('#notes-count');
    if (badge) badge.textContent = `${rows.length} note`;

    // render
    list.innerHTML = '';
    if (!rows.length){
      list.innerHTML = '<div class="muted">Nessuna nota con i filtri selezionati.</div>';
    } else {
      for (const n of rows){
        const el = document.createElement('div');
        el.className = 'note';
        el.innerHTML = `
          <div class="note-top">
            <strong>${n.ch}</strong> • <span class="pill ${n.s ? ('s'+n.s[1]) : ''}">${n.s}</span>
            <span class="muted" style="margin-left:auto">${n.date || ''}</span>
          </div>
          <div class="note-text">${(n.text||'').replaceAll('<','&lt;').replaceAll('>','&gt;')}</div>
        `;
        list.appendChild(el);
      }
    }

    // listeners filtri (una sola volta)
    const re = () => renderNotes();
    if (selCh && !selCh._on){ selCh.addEventListener('change', re); selCh._on=true; }
    if (dFrom && !dFrom._on){ dFrom.addEventListener('change', re); dFrom._on=true; }
    if (dTo   && !dTo._on){   dTo.addEventListener('change', re);   dTo._on=true; }
    if (btnCl && !btnCl._on){
      btnCl.addEventListener('click', () => {
        if (selCh) selCh.value = '';
        if (dFrom) dFrom.value = '';
        if (dTo)   dTo.value   = '';
        renderNotes();
      });
      btnCl._on = true;
    }
  }

  function paintNotesBadge(){
    const badge = $('#notes-badge');
    if (!badge) return;
    const count = collectAllNotes().length;
    badge.textContent = 'Note';
    badge.title = `${count} note`;
  }

  // -----------------------------------
  // Lock / Export / Import bindings
  // -----------------------------------
function initCommon(){
  // NOTE
  const btnNotes = document.querySelector('#btn-notes');
  if (btnNotes && !btnNotes._on){
    btnNotes.addEventListener('click', () => { location.href = 'notes.html'; });
    btnNotes._on = true;
  }

  // IMPORT
  const btnImport = document.querySelector('#btn-import');
  const input     = document.querySelector('#import-input');
  if (btnImport && input && !btnImport._on){
    btnImport.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleImport(input.files));
    btnImport._on = true;
  }

  // EXPORT (PIN)
  const btnExport = document.querySelector('#btn-export');
  if (btnExport && !btnExport._on){
    btnExport.addEventListener('click', () => {
      const pin = prompt('Inserisci PIN (demo 1234):');
      if (pin !== '1234'){ alert('PIN errato'); return; }
      const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'SKF-5S-supervisor-archive.json';
      a.click();
    });
    btnExport._on = true;
  }

  // LOCK (cambio PIN)
  const btnLock = document.querySelector('#btn-lock');
  if (btnLock && !btnLock._on){
    const key = 'skf5s:pin';
    btnLock.addEventListener('click', () => {
      const current = localStorage.getItem(key) || '1234';
      const inPin = prompt('PIN attuale (default 1234). Lascia vuoto per solo controllo:');
      if (inPin === null) return;
      if (inPin && inPin !== current){ alert('PIN errato'); return; }
      const np = prompt('Nuovo PIN (lascia vuoto per non modificare):');
      if (np){ localStorage.setItem(key, np); alert('PIN aggiornato'); }
    });
    btnLock._on = true;
  }

  // COMPRIMI / ESPANDI (solo pagina checklist)
  const btnToggle = document.querySelector('#btn-toggle-all');
  if (btnToggle && !btnToggle._on){
    let expanded = true;
    const apply = () => {
      document.querySelectorAll('.ch-card .bars').forEach(el => {
        el.style.display = expanded ? '' : 'none';
      });
      btnToggle.textContent = expanded ? 'Comprimi tutti i CH' : 'Espandi tutti i CH';
    };
    btnToggle.addEventListener('click', () => { expanded = !expanded; apply(); });
    apply();
    btnToggle._on = true;
  }
}

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // boot
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    render();
    // SW semplice, non aggressivo
    if ('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }
  });
})();
