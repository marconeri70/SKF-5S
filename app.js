// SKF 5S Supervisor — single JS for all pages (v2.3.7)
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY = 'skf5s:pin';
  const LOCK_KEY = 'skf5s:locked';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- Store ----------
  const store = {
    load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch{ return []; } },
    save(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // ---------- PIN / Lock ----------
  function getPin(){ return localStorage.getItem(PIN_KEY) || '1234'; }
  function setPin(v){ localStorage.setItem(PIN_KEY, v); }
  function isLocked(){ return localStorage.getItem(LOCK_KEY) !== '0'; }
  function setLocked(flag){ localStorage.setItem(LOCK_KEY, flag ? '1' : '0'); paintLock(); }

  function paintLock(){
    $$('#btn-lock').forEach(btn=>{
      if (!btn) return;
      btn.textContent = isLocked() ? '🔒' : '🔓';
      btn.title = isLocked() ? 'Sblocca / Cambia PIN' : 'Blocca';
    });
  }

  // Click sul lucchetto:
  // - se bloccato: chiede PIN attuale; se corretto chiede nuovo PIN (opzionale); sblocca
  // - se sbloccato: blocca
  function onLockClick(){
    if (isLocked()){
      const cur = prompt('Inserisci PIN corrente (default 1234):');
      if (cur == null) return;
      if (cur !== getPin()){ alert('PIN errato.'); return; }
      const want = confirm('Vuoi cambiare il PIN?');
      if (want){
        const n1 = prompt('Nuovo PIN (4-8 cifre):','');
        if (n1 == null || !/^\d{4,8}$/.test(n1)){ alert('PIN non valido.'); return; }
        const n2 = prompt('Conferma nuovo PIN:','');
        if (n1 !== n2){ alert('I PIN non coincidono.'); return; }
        setPin(n1);
        alert('PIN aggiornato.');
      }
      setLocked(false);
    } else {
      setLocked(true);
    }
  }

  // ---------- Import ----------
  async function handleImport(files) {
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));
    let ok = 0;

    for (const f of files) {
      try {
        const rec = JSON.parse(await f.text());
        // formato atteso: {area, channel, date, points:{s1..s5}, notes|detail}
        if (rec && rec.area && rec.channel && rec.points) {
          const k = rec.area + '|' + rec.channel + '|' + rec.date;
          byKey.set(k, rec);
          ok++;
        }
      } catch (e) {
        alert('File non valido: ' + f.name);
      }
    }
    const merged = Array.from(byKey.values())
      .sort((a,b)=> new Date(a.date)-new Date(b.date));
    store.save(merged);
    alert(`Import completato: ${ok} file uniti (${merged.length} record totali).`);
    render();
  }

  // ---------- Export ----------
  function exportWithPin(){
    const pin = prompt('Inserisci PIN (demo 1234):');
    if (pin !== getPin()){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // ---------- Home: grafico tutti i CH ----------
  function renderHome(){
    if (document.body.dataset.page !== 'home') return;
    const data = store.load();

    // chip navigazione CH
    const chips = $('#chip-strip');
    chips.innerHTML = '';
    const byCh = groupByChannel(data);
    for (const ch of byCh.keys()){
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chips.appendChild(chip);
    }

    // canvas grande con scroll
    const wrap = $('#allch-wrap');
    const canvas = $('#allch');
    const ctx = canvas.getContext('2d');

    const channels = [...byCh.keys()];
    const lastPerCh = channels.map(ch => {
      const arr = byCh.get(ch).slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
      return { ch, last: arr[arr.length-1] };
    });

    // dimensionamento: 220px per CH (min 800)
    const width = Math.max(800, lastPerCh.length * 220);
    canvas.width = width;

    // esterni
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    const chartTop = 30;
    const chartBottom = canvas.height - 60;
    const colW = width / Math.max(1,lastPerCh.length);
    const barH = 18;
    const gap = 6;

    const colors = [getCSS('--s1'), getCSS('--s2'), getCSS('--s3'), getCSS('--s4'), getCSS('--s5')];

    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    lastPerCh.forEach((row, idx) => {
      const x0 = colW*idx + colW*0.1;
      const w = colW*0.8;
      const vals = [
        row.last?.points?.s1||0,
        row.last?.points?.s2||0,
        row.last?.points?.s3||0,
        row.last?.points?.s4||0,
        row.last?.points?.s5||0,
      ];
      // disegna 5 barre orizzontali (da sinistra a destra)
      vals.forEach((v, i) => {
        const y = chartTop + i*(barH+gap);
        const L = Math.max(2, Math.round(w * (v/100)));
        ctx.fillStyle = colors[i];
        ctx.fillRect(x0, y, L, barH, 4);
        // valore
        ctx.fillStyle = '#1b2a3a';
        ctx.fillText(`${['1S','2S','3S','4S','5S'][i]} ${v}%`, x0 + L + 24, y+1);
      });

      // etichetta canale
      ctx.fillStyle = '#445';
      ctx.textBaseline = 'bottom';
      ctx.fillText(row.ch, x0 + w/2, chartBottom);
      ctx.textBaseline = 'top';
    });
  }

  function getCSS(varName){
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function groupByChannel(data){
    const byCh = new Map();
    for (const r of data) {
      const key = String(r.channel || 'CH?');
      (byCh.get(key) || byCh.set(key, []).get(key)).push(r);
    }
    return byCh;
  }

  // ---------- Checklist ----------
  function renderChecklist(){
    if (document.body.dataset.page !== 'checklist') return;
    const wrap = $('#cards');
    const data = store.load();
    wrap.innerHTML = '';

    const byCh = groupByChannel(data);
    for (const [ch, arr] of byCh){
      const last = arr.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).pop();
      const k = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((k.s1+k.s2+k.s3+k.s4+k.s5)/5);

      const card = document.createElement('div');
      card.className = 'card-line';
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${ch}</div>
            <div class="muted" style="color:#7a8aa0;font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||''}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${k.s1}%</span>
            <span class="pill s2">S2 ${k.s2}%</span>
            <span class="pill s3">S3 ${k.s3}%</span>
            <span class="pill s4">S4 ${k.s4}%</span>
            <span class="pill s5">S5 ${k.s5}%</span>
            <span class="badge">Voto medio ${avg}%</span>
          </div>
          <div><button class="btn outline btn-print">Stampa PDF</button></div>
        </div>
        <div class="bars" style="margin-top:10px">
          ${['1S','2S','3S','4S','5S'].map((lab,i) => {
            const v = [k.s1,k.s2,k.s3,k.s4,k.s5][i]||0;
            const cls = ['s1','s2','s3','s4','s5'][i];
            return `
              <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
                <div style="width:24px;color:#7a8aa0">${lab}</div>
                <div class="barline ${cls}">
                  <div style="width:${Math.max(2, v)}%"></div>
                </div>
                <div style="width:36px;color:#445;font-weight:700">${v}%</div>
              </div>`;
          }).join('')}
        </div>
      `;
      wrap.appendChild(card);

      // stampa singolo
      card.querySelector('.btn-print').onclick = () => {
        const html = card.outerHTML;
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>CH ${ch}</title><link rel="stylesheet" href="style.css"></head><body>${html}</body></html>`);
        w.document.close(); w.focus(); w.print();
      };
    }

    // comprimi/espandi tutti (vera funzione: alterna le barre)
    let collapsed = false;
    const toggleBtn = $('#btn-toggle-all');
    if (toggleBtn){
      toggleBtn.onclick = () => {
        collapsed = !collapsed;
        $$('.bars').forEach(el => el.style.display = collapsed ? 'none' : '');
      };
    }

    const printAll = $('#btn-print-all');
    if (printAll){
      printAll.onclick = () => window.print();
    }
  }

  // stile barre orizzontali in schede
  const styleBar = document.createElement('style');
  styleBar.textContent = `
    .barline{flex:1;height:14px;background:#edf2ff;border-radius:999px;overflow:hidden;box-shadow:inset 0 0 0 1px #dbe6ff}
    .barline>div{height:100%}
    .barline.s1>div{background:var(--s1)}
    .barline.s2>div{background:var(--s2)}
    .barline.s3>div{background:var(--s3)}
    .barline.s4>div{background:var(--s4)}
    .barline.s5>div{background:var(--s5)}
  `;
  document.head.appendChild(styleBar);

  // ---------- Notes (filtri + lista) ----------
  function renderNotes(){
    if (document.body.dataset.page !== 'notes') return;

    const data = store.load();
    const allNotes = [];
    for (const r of data){
      const raw = Array.isArray(r.notes) ? r.notes
                : Array.isArray(r.detail) ? r.detail
                : [];
      // normalizza: accetta {s:'S1', text:'...', date:'...'} o {S: '1S', note:'...'}
      raw.forEach(n => {
        const s = n.s || n.S || n.type || '';
        const text = n.text || n.note || '';
        const date = n.date || r.date || '';
        if (text) allNotes.push({ ch: String(r.channel||''), area: r.area||'', s, text, date });
      });
    }

    // riempi select CH
    const sel = $('#f-ch');
    const uniques = [...new Set(allNotes.map(n => n.ch))].sort();
    uniques.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch; opt.textContent = ch;
      sel.appendChild(opt);
    });

    const box = $('#notes-list');
    const count = $('#note-count');

    function applyFilters(){
      const fch = sel.value.trim();
      const df = $('#f-date-from').value ? new Date($('#f-date-from').value) : null;
      const dt = $('#f-date-to').value ? new Date($('#f-date-to').value) : null;

      let rows = allNotes.slice();
      if (fch) rows = rows.filter(r => r.ch === fch);
      if (df)  rows = rows.filter(r => new Date(r.date) >= df);
      if (dt)  rows = rows.filter(r => new Date(r.date) <= new Date(dt.getTime()+24*60*60*1000-1));

      rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
      box.innerHTML = '';
      if (!rows.length){
        box.innerHTML = '<div class="muted" style="padding:.6rem 0;color:#7a8aa0">Nessuna nota con i filtri selezionati.</div>';
      } else {
        rows.forEach(n => {
          const el = document.createElement('div');
          el.className = 'note';
          const pillCls = 's' + (String(n.s).match(/\d/)?.[0] || '');
          el.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
              <div><strong>${n.ch}</strong> • <span class="pill ${pillCls}">${n.s||''}</span></div>
              <div class="muted" style="color:#7a8aa0">${n.date||''}</div>
            </div>
            <div style="margin-top:.4rem;white-space:pre-wrap">${n.text}</div>
          `;
          box.appendChild(el);
        });
      }
      count.textContent = `${rows.length} note`;
    }

    $('#f-ch').onchange = applyFilters;
    $('#f-date-from').onchange = applyFilters;
    $('#f-date-to').onchange = applyFilters;
    $('#btn-clear-filters').onclick = () => {
      $('#f-ch').value = '';
      $('#f-date-from').value = '';
      $('#f-date-to').value = '';
      applyFilters();
    };

    applyFilters();
  }

  // ---------- Common init ----------
  function initCommon(){
    // import (top button on all pages)
    $$('#btn-import-top').forEach(btn => {
      if (!btn) return;
      btn.onclick = () => $('#import-input').click();
    });
    const input = $('#import-input');
    if (input) input.onchange = () => { handleImport(input.files); input.value=''; };

    // export
    $$('#btn-export,#btn-export-supervisor').forEach(b => b && (b.onclick = exportWithPin));

    // notes nav
    $$('#btn-notes').forEach(b => b && (b.onclick = () => location.href='notes.html'));

    // lock
    $$('#btn-lock').forEach(b => b && (b.onclick = onLockClick));

    paintLock();
  }

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // boot
  window.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem(LOCK_KEY)) setLocked(true); // prima volta: bloccato
    initCommon();
    render();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  });
})();
