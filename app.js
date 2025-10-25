// SKF 5S Supervisor — unico JS per tutte le pagine
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY = 'skf5s:pin';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- storage ----------
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn(e); return []; }
    },
    save(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // ---------- import ----------
  async function handleImport(files) {
    if (!files || !files.length) return;
    const current = store.load();
    const map = new Map(current.map(x => [keyOf(x), x]));

    for (const f of files) {
      try {
        const txt = await f.text();
        let obj = JSON.parse(txt);
        const arr = Array.isArray(obj) ? obj : [obj];
        for (const rec of arr) {
          const normalized = normalizeRecord(rec);
          if (normalized) map.set(keyOf(normalized), normalized);
        }
      } catch (e) {
        alert('File non valido: ' + f.name);
      }
    }
    const merged = Array.from(map.values()).sort((a,b)=> new Date(a.date)-new Date(b.date));
    store.save(merged);
    // consente un nuovo import immediatamente
    const input = $('#import-input'); if (input) input.value = '';
    render();
    alert('Import completato: ' + merged.length + ' record totali');
  }

  function keyOf(r){ return [r.area||'', r.channel||'', r.date||''].join('|'); }

  // Supporta formati diversi dei file JSON
  function normalizeRecord(r){
    if (!r) return null;
    // accetta nomi campo diffusi
    const area = r.area || r.Area || r.Reparto || '';
    const channel = r.channel || r.CH || r.canale || r.line || r.Linea || '';
    const date = r.date || r.data || r.timestamp || new Date().toISOString();
    const points = r.points || r.Punteggi || {
      s1: Number(r.s1||r.S1||0), s2: Number(r.s2||r.S2||0),
      s3: Number(r.s3||r.S3||0), s4: Number(r.s4||r.S4||0),
      s5: Number(r.s5||r.S5||0)
    };

    // NOTE: raccogli sia r.notes[] sia sezioni con testi S1..S5
    let notes = [];
    if (Array.isArray(r.notes)) {
      for (const n of r.notes) {
        notes.push({
          s: n.s || n.S || n.type || '',
          text: n.text || n.note || '',
          date: n.date || date
        });
      }
    } else {
      // esempio: { S1:[ "testo1", "testo2" ], S2:[ ... ] } oppure stringhe
      ['S1','S2','S3','S4','S5','s1','s2','s3','s4','s5'].forEach(k=>{
        if (r[k]) {
          const list = Array.isArray(r[k]) ? r[k] : String(r[k]).split(/\n|;|·|- /);
          list.filter(Boolean).forEach(t=> notes.push({ s: k.toUpperCase(), text: String(t).trim(), date }));
        }
      });
      // eventuali “sections”
      if (Array.isArray(r.sections)) {
        for (const sec of r.sections) {
          const tag = (sec.s || sec.name || '').toString().toUpperCase();
          const list = Array.isArray(sec.items) ? sec.items : (sec.text ? [sec.text] : []);
          list.forEach(t => notes.push({ s: tag, text: t, date: sec.date || date }));
        }
      }
    }

    return { area, channel, date, points, notes, delays: Number(r.delays||0) };
  }

  // ---------- export (PIN) ----------
  function getPIN(){ return localStorage.getItem(PIN_KEY) || '1234'; }
  function exportWithPin(){
    const curr = getPIN();
    const pin = prompt('Inserisci PIN (demo 1234):', '');
    if (pin !== curr) { alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // ---------- lock (consente cambio PIN) ----------
  function initLock(){
    const btn = $('#btn-lock'); if (!btn) return;
    let locked = sessionStorage.getItem('lock') === '1';
    const paint = () => btn.textContent = locked ? '🔓' : '🔒';
    paint();
    btn.onclick = () => {
      const curr = getPIN();
      const pin = prompt('Inserisci PIN attuale (demo 1234):','');
      if (pin !== curr) { alert('PIN errato'); return; }
      const nuovo = prompt('Inserisci nuovo PIN:', curr);
      if (nuovo && nuovo !== curr){ localStorage.setItem(PIN_KEY, nuovo); alert('PIN aggiornato'); }
      locked = !locked; sessionStorage.setItem('lock', locked?'1':'0'); paint();
    };
  }

  // ---------- UI comuni ----------
  function initCommon(){
    const input = $('#import-input');
    $('#btn-import')?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', () => handleImport(input.files));

    $('#btn-export')?.addEventListener('click', exportWithPin);
    $('#btn-export-supervisor')?.addEventListener('click', exportWithPin);

    $('#btn-notes')?.addEventListener('click', () => location.href = 'notes.html');
  }

  // ---------- home ----------
  function renderHome(){
    if (document.body.dataset.page !== 'home') return;
    const data = store.load();
    const filterArea = $('#area-filter').value;
    const filtered = filterArea ? data.filter(d => (d.area||'') === filterArea) : data;

    // group last per CH
    const byCh = new Map();
    for (const r of filtered){
      const k = r.channel || 'CH ?';
      const arr = byCh.get(k) || [];
      arr.push(r); byCh.set(k, arr);
    }

    const htrack = $('#htrack'); htrack.innerHTML = '';
    const chips = $('#chip-strip'); chips.innerHTML = '';

    for (const [ch, arr] of byCh){
      const last = arr.sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const cell = document.createElement('div'); cell.className = 'hcell';
      cell.innerHTML = `
        <h4>${ch} <span class="muted">${last?.area||''}</span></h4>
        <div class="hbars">
          ${['1S','2S','3S','4S','5S'].map((lab,i)=>{
            const val = [p.s1,p.s2,p.s3,p.s4,p.s5][i]||0;
            return `<div class="hrow s${i+1}">
              <div class="hlabel">${lab}</div>
              <div class="hbar"><i style="width:${val}%"></i></div>
              <div class="hval">${val}%</div>
            </div>`;
          }).join('')}
        </div>`;
      htrack.appendChild(cell);

      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#'+encodeURIComponent(ch);
      chips.appendChild(chip);
    }

    $('#area-filter')?.addEventListener('change', renderHome);
  }

  // ---------- checklist ----------
  function renderChecklist(){
    if (document.body.dataset.page !== 'checklist') return;
    const data = store.load();

    // group per CH
    const byCh = new Map();
    for (const r of data){
      const k = r.channel || 'CH ?';
      const arr = byCh.get(k) || [];
      arr.push(r); byCh.set(k, arr);
    }

    const wrap = $('#cards'); wrap.innerHTML = '';

    for (const [ch, arr] of byCh){
      const last = arr.sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((p.s1+p.s2+p.s3+p.s4+p.s5)/5);

      const card = document.createElement('div'); card.className='card-line';
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">${ch}</div>
            <div class="muted">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div>
            <span class="pill s1">S1 ${p.s1}%</span>
            <span class="pill s2">S2 ${p.s2}%</span>
            <span class="pill s3">S3 ${p.s3}%</span>
            <span class="pill s4">S4 ${p.s4}%</span>
            <span class="pill s5">S5 ${p.s5}%</span>
          </div>
          <div class="kpi"><span class="badge">Voto medio ${avg}%</span></div>
          <div><button class="btn outline" data-print="${ch}">Stampa PDF</button></div>
        </div>

        <div class="hl">
          ${[['1S','s1'],['2S','s2'],['3S','s3'],['4S','s4'],['5S','s5']].map(([lab,k],i)=>{
            const v = p[k]||0;
            return `<div class="barrow">
              <div class="lbl">${lab}</div>
              <div class="bar s${i+1}c"><i style="width:${v}%"></i></div>
              <div class="val">${v}%</div>
            </div>`;
          }).join('')}
        </div>

        <details>
          <summary>Note</summary>
          <div>${renderNotesHtml(arr)}</div>
        </details>
      `;
      wrap.appendChild(card);
    }

    // stampa singolo
    $$('button[data-print]').forEach(b=>{
      b.addEventListener('click', e=>{
        e.stopPropagation();
        window.print();
      });
    });

    // toggle tutti
    $('#btn-toggle-all')?.addEventListener('click', ()=>{
      const all = $$('details', wrap);
      const anyOpen = all.some(d=>!d.open);
      all.forEach(d=> d.open = anyOpen);
    });

    // stampa tutti
    $('#btn-print-all')?.addEventListener('click', ()=> window.print());
  }

  function renderNotesHtml(records){
    const list = [];
    for (const r of records){
      const arr = Array.isArray(r.notes) ? r.notes : [];
      arr.forEach(n=>{
        list.push(`<div class="note">
          <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
            <div><span class="pill s${(n.s||'S1')[1]||1}">${n.s||''}</span></div>
            <div class="muted">${n.date||r.date||''}</div>
          </div>
          <div style="margin-top:.4rem">${(n.text||'').replaceAll('\n','<br>')}</div>
        </div>`);
      });
    }
    return list.join('') || '<div class="muted">Nessuna nota per questo CH.</div>';
  }

  // ---------- pagina note ----------
  function renderNotesPage(){
    if (document.body.dataset.page !== 'notes') return;
    const data = store.load();

    // compila select CH
    const sel = $('#filter-ch');
    const channels = [...new Set(data.map(d=>d.channel).filter(Boolean))].sort();
    channels.forEach(ch=>{
      const o = document.createElement('option'); o.value = ch; o.textContent = ch; sel.appendChild(o);
    });

    function apply(){
      const chSel = sel.value;
      const from = $('#from-date').value ? new Date($('#from-date').value) : null;
      const to   = $('#to-date').value   ? new Date($('#to-date').value)   : null;

      const rows = [];
      for (const r of data){
        if (chSel && r.channel !== chSel) continue;
        const arr = Array.isArray(r.notes) ? r.notes : [];
        for (const n of arr){
          const d = new Date(n.date || r.date || 0);
          if (from && d < from) continue;
          if (to && d > to) continue;
          rows.push({ ch:r.channel, date:d.toISOString(), s:n.s||'', text:n.text||'' });
        }
      }
      rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
      $('#notes-count').textContent = `${rows.length} note`;

      const box = $('#notes-list');
      box.innerHTML = rows.map(n=>`
        <div class="note">
          <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
            <div><strong>${n.ch}</strong> • <span class="pill s${(n.s||'S1')[1]||1}">${n.s||''}</span></div>
            <div class="muted">${n.date}</div>
          </div>
          <div style="margin-top:.35rem">${n.text.replaceAll('\n','<br>')}</div>
        </div>`).join('') || '<div class="muted">Nessuna nota con i filtri selezionati.</div>';
    }

    ['change','input'].forEach(ev=>{
      $('#filter-ch').addEventListener(ev, apply);
      $('#from-date').addEventListener(ev, apply);
      $('#to-date').addEventListener(ev, apply);
    });
    $('#btn-clear').addEventListener('click', ()=>{
      $('#filter-ch').value=''; $('#from-date').value=''; $('#to-date').value=''; apply();
    });
    apply();
  }

  // ---------- render dispatcher ----------
  function render(){
    renderHome();
    renderChecklist();
    renderNotesPage();
  }

  // ---------- avvio ----------
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();
    if ('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
  });
})();
