// SKF 5S Supervisor — unico JS
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY = 'skf5s:pin';

  const $  = (sel, root=document)=> root.querySelector(sel);
  const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));

  // ---------------- Store ----------------
  const store = {
    load(){
      try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn(e); return []; }
    },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // ---------- Import (multi + merge) ----------
  async function handleImport(files){
    if(!files || !files.length) return;
    const cur = store.load();
    const map = new Map(cur.map(r => [keyOf(r), r]));

    for (const f of files){
      try{
        const rec = JSON.parse(await f.text());
        // normalizzo: accetto sia {area,channel,date,points:{s1..},notes:[...]}
        // sia payload con 'ch' / 'linea' / 'data' ecc.
        const norm = normalizeRecord(rec);
        if (norm) map.set(keyOf(norm), norm);
      }catch(e){
        alert('File non valido: '+ f.name);
      }
    }
    const merged = Array.from(map.values()).sort((a,b)=> (a.channel||'').localeCompare(b.channel||''));
    store.save(merged);
    // reset input per consentire re-import dello stesso file
    const input = $('#import-input'); if (input) input.value = '';
    render();
  }
  const keyOf = r => `${r.area||''}|${r.channel||''}|${r.date||''}`;
  function normalizeRecord(x){
    if(!x) return null;
    const area = x.area || x.linea || x.reparto || '';
    const channel = x.channel || x.ch || x.canale || x.nome || '';
    const date = x.date || x.data || x.updatedAt || x.ultimo || new Date().toISOString();
    let pts = x.points || x.punteggi || x.scores;
    if(!pts && x.S){ // alcune versioni hanno S:{s1:..}
      pts = x.S;
    }
    if(!pts && Array.isArray(x.kpis)){
      const [s1,s2,s3,s4,s5] = x.kpis;
      pts = {s1,s2,s3,s4,s5};
    }
    if(!pts){ pts = {s1:0,s2:0,s3:0,s4:0,s5:0}; }
    const notes = collectNotesFromAny(x);
    return {area, channel, date, points:pts, notes};
  }

  // Estrattore note robusto (tenta varie strutture)
  function collectNotesFromAny(obj){
    const rows=[];
    // 1) note dirette
    if (Array.isArray(obj.notes)) {
      obj.notes.forEach(n=> rows.push({s:n.s||n.S||n.type||'', text:n.text||n.note||'', date:n.date||obj.date||''}));
    }
    // 2) per ciascuna S come array di item con note
    ['s1','s2','s3','s4','s5','S1','S2','S3','S4','S5'].forEach(k=>{
      const sec = obj[k];
      if (Array.isArray(sec)) {
        sec.forEach(it=>{
          const txt = it.note || it.notes || it.text;
          if (txt) rows.push({s:k.toUpperCase(), text:String(txt), date:it.date||obj.date||''});
        });
      }
    });
    // 3) annidate in sections/items
    (obj.sections||obj.items||[]).forEach(sec=>{
      if (Array.isArray(sec.items)){
        sec.items.forEach(it=>{
          if (it.note) rows.push({s:sec.s||sec.S||sec.type||'', text:String(it.note), date:it.date||obj.date||''});
        });
      }
    });
    return rows;
  }

  // ---------- Export con PIN ----------
  function exportWithPin(){
    const pin = getPinWithUI(); if(pin===false) return;
    const blob = new Blob([JSON.stringify(store.load(),null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }
  function getPinWithUI(){
    const cur = localStorage.getItem(PIN_KEY) || '1234';
    const in1 = prompt('Inserisci PIN (demo 1234):');
    if (in1===null) return false;
    if (in1!==cur){ alert('PIN errato'); return false; }
    // opzionalmente cambio
    if (confirm('Vuoi cambiare PIN?')){
      const n1 = prompt('Nuovo PIN (4-8 cifre):','');
      if(!n1 || !/^\d{4,8}$/.test(n1)){ alert('PIN non valido'); return false; }
      localStorage.setItem(PIN_KEY, n1);
      alert('PIN aggiornato');
    }
    return true;
  }

  // ---------- Lucchetto (solo stato visivo + gating export) ----------
  function initLock(){
    const btn = $('#btn-lock'); if(!btn) return;
    let locked = sessionStorage.getItem('lock') !== '0';
    const paint = ()=> btn.textContent = locked ? '🔒' : '🔓';
    paint();
    btn.onclick = ()=>{
      if (locked){
        const cur = localStorage.getItem(PIN_KEY) || '1234';
        const in1 = prompt('Inserisci PIN (demo 1234):');
        if (in1!==cur){ alert('PIN errato'); return; }
      }
      locked = !locked;
      sessionStorage.setItem('lock', locked?'1':'0');
      // se stiamo sbloccando, offri cambio PIN
      if (!locked && confirm('Vuoi cambiare PIN?')){
        const n1 = prompt('Nuovo PIN (4-8 cifre):','');
        if(n1 && /^\d{4,8}$/.test(n1)){ localStorage.setItem(PIN_KEY, n1); alert('PIN aggiornato'); }
      }
      paint();
    };
  }

  // ---------- Grafico Unificato (orizzontale + scroll) ----------
  function renderUnified(canvas, datasets){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const chs = Array.from(datasets.keys());
    const W = Math.max(700, chs.length * 220); // larghezza dinamica
    const H = canvas.height; // fisso da CSS
    canvas.width = W;
    ctx.clearRect(0,0,W,H);

    // assi
    const left = 80, right = 20, top = 20, rowH = 36;
    const colors = ['#7c3aed','#ef4444','#f59e0b','#10b981','#2563eb'];

    chs.forEach((ch, idx)=>{
      const x = left + idx*200;
      const y0 = top;
      // titolo CH
      ctx.fillStyle = '#6b7280';
      ctx.font = '600 13px system-ui';
      ctx.textAlign='center';
      ctx.fillText(ch, x+70, H-8);

      // 5 barre orizzontali (più grandi e leggibili)
      const vals = datasets.get(ch);
      for(let i=0;i<5;i++){
        const val = Math.max(0, Math.min(100, vals[i]||0));
        const y = y0 + i*rowH;
        // track
        ctx.fillStyle='#eef2ff';
        ctx.fillRect(x, y, 140, 14);
        // value
        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y, 1.4*val, 14); // 100% => 140px
        // label sinistra
        ctx.fillStyle = '#6b7280';
        ctx.font = '600 12px system-ui';
        ctx.textAlign='right';
        const lab = ['1S','2S','3S','4S','5S'][i];
        ctx.fillText(lab, x-6, y+12);
      }
    });
  }

  // ---------- HOME ----------
  function renderHome(){
    if (document.body.dataset.page!=='home') return;
    const data = store.load();
    // chips
    const chips = $('#chip-strip'); chips.innerHTML='';
    // raggruppo per CH e prendo ultimo snapshot
    const grouped = new Map();
    data.forEach(r=>{
      const k = r.channel || 'CH ?';
      const arr = grouped.get(k)||[]; arr.push(r); grouped.set(k, arr);
    });
    const lastByCh = new Map();
    grouped.forEach((arr,k)=>{
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      lastByCh.set(k,[ last.points.s1||0,last.points.s2||0,last.points.s3||0,last.points.s4||0,last.points.s5||0 ]);
      const chip = document.createElement('button');
      chip.className='chip'; chip.textContent = k;
      chip.onclick = ()=> location.href = 'checklist.html#'+encodeURIComponent(k);
      chips.appendChild(chip);
    });
    // grafico unificato
    renderUnified($('#uniChart'), lastByCh);
  }

  // ---------- CHECKLIST ----------
  function renderChecklist(){
    if (document.body.dataset.page!=='checklist') return;
    const wrap = $('#cards'); wrap.innerHTML='';
    const data = store.load();
    const byCh = new Map();
    data.forEach(r=>{
      const k = r.channel || 'CH ?';
      const arr = byCh.get(k)||[]; arr.push(r); byCh.set(k, arr);
    });
    // cards
    byCh.forEach((arr, chName)=>{
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last.points || {};
      const avg = Math.round((+p.s1 + +p.s2 + +p.s3 + +p.s4 + +p.s5)/5 || 0);
      const card = document.createElement('section');
      card.className='card';
      card.innerHTML = `
        <div class="card-head">
          <div>
            <div style="font-weight:800">${chName}</div>
            <div class="muted" style="font-size:.9rem">${last.area||''} • Ultimo: ${last.date||''}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${p.s1||0}%</span>
            <span class="pill s2">S2 ${p.s2||0}%</span>
            <span class="pill s3">S3 ${p.s3||0}%</span>
            <span class="pill s4">S4 ${p.s4||0}%</span>
            <span class="pill s5">S5 ${p.s5||0}%</span>
            <span class="badge">Voto medio ${avg}%</span>
            <button class="btn outline btn-print-one">Stampa PDF</button>
          </div>
        </div>
        <div class="chartbars" style="margin-top:.6rem">
          ${['1S','2S','3S','4S','5S'].map((s,i)=>{
            const v=[p.s1,p.s2,p.s3,p.s4,p.s5][i]||0;
            const cls=['s1','s2','s3','s4','s5'][i];
            return `<div style="display:flex;align-items:center;gap:.6rem;margin:.25rem 0">
              <div class="muted" style="width:28px;text-align:right">${s}</div>
              <div style="background:#eef2ff;border-radius:999px;overflow:hidden;height:12px;width:70%">
                <div class="${cls}" style="background:var(--${cls});height:12px;width:${v}%;"></div>
              </div>
              <div class="muted" style="min-width:42px">${v}%</div>
            </div>`;
          }).join('')}
        </div>
      `;
      // stampa singola scheda
      card.querySelector('.btn-print-one').onclick = ()=>{
        const html = card.outerHTML;
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>${chName}</title><link rel="stylesheet" href="style.css"></head><body>${html}</body></html>`);
        w.document.close(); w.focus(); w.print(); w.close();
      };
      wrap.appendChild(card);
    });

    // stampa TUTTI
    $('#btn-print-all')?.addEventListener('click', ()=>{
      window.print();
    });

    // comprimi/espandi -> demo: nessun contenuto extra per ora
    $('#btn-toggle-all')?.addEventListener('click', ()=>{
      alert('Comprimi/Espandi: demo (aggiungeremo dettagli se servono).');
    });
  }

  // ---------- NOTE ----------
  function renderNotes(){
    if (document.body.dataset.page!=='notes') return;
    const list = $('#notes-list');
    const all = store.load();

    // compilo elenco CH
    const sel = $('#flt-ch'); sel.innerHTML='';
    const optAll = document.createElement('option'); optAll.value=''; optAll.textContent='Tutti'; sel.appendChild(optAll);
    Array.from(new Set(all.map(r=> r.channel))).sort().forEach(ch=>{
      const o=document.createElement('option'); o.value=ch; o.textContent=ch; sel.appendChild(o);
    });

    function apply(){
      const ch = sel.value;
      const from = $('#flt-from').value ? new Date($('#flt-from').value) : null;
      const to   = $('#flt-to').value   ? new Date($('#flt-to').value)   : null;
      const rows=[];
      all.forEach(r=>{
        if (ch && r.channel!==ch) return;
        const baseDate = new Date(r.date||0);
        const noteRows = collectNotesFromAny(r);
        noteRows.forEach(n=>{
          const d = new Date(n.date || r.date || baseDate);
          if (from && d<from) return;
          if (to   && d> new Date(to.getTime()+24*3600*1000-1)) return; // inclusivo
          rows.push({ch:r.channel, s:(n.s||'').toString().toUpperCase(), text:n.text||'', date:d.toISOString()});
        });
      });

      list.innerHTML='';
      $('#notes-counter').textContent = rows.length+' note';

      if (!rows.length){
        list.innerHTML = `<div class="muted">Nessuna nota con i filtri selezionati.</div>`;
        return;
      }

      rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
      rows.forEach(n=>{
        const el = document.createElement('div');
        el.className='note';
        el.innerHTML = `
          <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
            <div><strong>${n.ch}</strong> • <span class="pill ${n.s?('s'+n.s[0].toLowerCase()):''}">${n.s||''}</span></div>
            <div class="muted">${n.date}</div>
          </div>
          <div style="margin-top:.4rem;white-space:pre-wrap">${n.text}</div>
        `;
        list.appendChild(el);
      });
    }

    $('#flt-clear').onclick = ()=> { $('#flt-from').value=''; $('#flt-to').value=''; $('#flt-ch').value=''; apply(); };
    $('#flt-from').onchange = $('#flt-to').onchange = $('#flt-ch').onchange = apply;
    apply(); // mostra tutto all'avvio
  }

  // ---------- Common init ----------
  function initCommon(){
    // Import
    $('#btn-import')?.addEventListener('click', ()=> $('#import-input').click());
    $('#import-input')?.addEventListener('change', e=> handleImport(e.target.files));

    // Export
    $('#btn-export')?.addEventListener('click', exportWithPin);
    $('#btn-export-supervisor')?.addEventListener('click', exportWithPin);

    // Note
    $('#btn-notes')?.addEventListener('click', ()=> location.href='notes.html');

    // Lock
    initLock();
  }

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // boot
  window.addEventListener('DOMContentLoaded', ()=>{
    initCommon(); render();
    if ('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
  });
})();
