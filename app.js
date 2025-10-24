<script>
// SKF 5S Supervisor — unified JS v2.3.4
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';

  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  const store = {
    load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch(e){ return []; } },
    save(v){ localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }
  };

  // ---------- Import ----------
  async function handleImport(files){
    if(!files || !files.length) return;
    const now = store.load();
    const key = r => `${r.area}|${r.channel}|${r.date}`;
    const map = new Map(now.map(r => [key(r), r]));

    for(const f of files){
      try{
        const txt = await f.text();
        const rec = JSON.parse(txt);
        // atteso: {area, channel, date, points:{s1..s5}, notes:[...]}
        if(rec && rec.area && rec.channel && rec.points){
          map.set(key(rec), rec);
        } else {
          alert('File non valido: ' + f.name);
        }
      }catch(e){
        alert('Errore su ' + f.name);
      }
    }
    const all = Array.from(map.values())
      .sort((a,b)=> String(a.channel).localeCompare(String(b.channel)));
    store.save(all);
    render();
  }

  // helper %
  function pct(v){ v = Number(v||0); if(isNaN(v)) v = 0; return Math.max(0, Math.min(100, v)); }

  // ---------- HOME (index.html) ----------
  function renderHome(){
    const wrap = $('#combined-chart');
    if(!wrap) return;
    wrap.innerHTML = '';

    const data = store.load();
    if(!data.length){
      wrap.innerHTML = '<div class="muted">Importa i file JSON dei CH per vedere i grafici.</div>';
      const chips = $('#chip-strip'); if(chips) chips.innerHTML = '';
      return;
    }

    // group by channel, prendi l’ultimo snapshot
    const byCh = new Map();
    for(const r of data){
      const k = r.channel || 'CH?';
      const arr = byCh.get(k) || [];
      arr.push(r); byCh.set(k, arr);
    }

    // pulsanti CH
    const chipStrip = $('#chip-strip'); if(chipStrip) chipStrip.innerHTML = '';
    for(const ch of byCh.keys()){
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chipStrip.appendChild(chip);
    }

    // card compatta per ogni CH
    for(const [ch, arr] of byCh){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];

      const card = document.createElement('div');
      card.className = 'mini';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem">
          <strong>${ch}</strong>
          <span class="muted">${last?.area||''} • Ultimo: ${last?.date||''}</span>
        </div>
        <div class="meter">
          ${['s1','s2','s3','s4','s5'].map((k,i)=>{
            const label = ['1S','2S','3S','4S','5S'][i];
            const v = pct(last?.points?.[k]);
            return `
              <div class="mrow">
                <div class="mlabel">${label}</div>
                <div class="barwrap"><div class="barfill ${k}" style="width:${v}%"></div></div>
                <div class="mval">${v}%</div>
              </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:.5rem;margin-top:.6rem">
          <button class="btn" onclick="location.href='checklist.html#${encodeURIComponent(ch)}'">Apri in checklist</button>
          <button class="btn outline" onclick="window.print()">Stampa PDF</button>
        </div>`;
      wrap.appendChild(card);
    }
  }

  // ---------- CHECKLIST ----------
  function renderChecklist(){
    const cont = $('#cards');
    if(!cont) return;
    cont.innerHTML = '';

    const data = store.load();
    const byCh = new Map();
    for(const r of data){
      const k = r.channel || 'CH?';
      const arr = byCh.get(k) || [];
      arr.push(r); byCh.set(k, arr);
    }

    for(const [ch, arr] of byCh){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const ps = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg = Math.round((pct(ps.s1)+pct(ps.s2)+pct(ps.s3)+pct(ps.s4)+pct(ps.s5))/5);

      const el = document.createElement('div');
      el.className = 'card-line';
      el.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:900">CH ${ch}</div>
            <div class="muted">${last?.area||''} • Ultimo: ${last?.date||''}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${pct(ps.s1)}%</span>
            <span class="pill s2">S2 ${pct(ps.s2)}%</span>
            <span class="pill s3">S3 ${pct(ps.s3)}%</span>
            <span class="pill s4">S4 ${pct(ps.s4)}%</span>
            <span class="pill s5">S5 ${pct(ps.s5)}%</span>
          </div>
          <div class="kpi"><span class="badge">Voto medio ${avg}%</span></div>
          <div><button class="btn outline" onclick="printOne(this)">Stampa PDF</button></div>
        </div>
        <div class="meter" style="margin-top:.8rem">
          ${['s1','s2','s3','s4','s5'].map((k,i)=>{
            const label = ['1S','2S','3S','4S','5S'][i];
            const v = pct(ps[k]);
            return `
              <div class="mrow">
                <div class="mlabel">${label}</div>
                <div class="barwrap"><div class="barfill ${k}" style="width:${v}%"></div></div>
                <div class="mval">${v}%</div>
              </div>`;
          }).join('')}
        </div>`;
      cont.appendChild(el);
    }

    // stampa singola card
    window.printOne = (btn)=>{
      const card = btn.closest('.card-line');
      const prev = document.body.innerHTML;
      document.body.innerHTML = card.outerHTML;
      window.print();
      document.body.innerHTML = prev;
      location.reload();
    };

    const printAll = $('#btn-print-all');
    if(printAll) printAll.onclick = ()=> window.print();

    const toggleAll = $('#btn-toggle-all');
    if(toggleAll) toggleAll.onclick = ()=> alert('Comprimi/Espandi: demo (aggiungeremo pannelli se servono)');
  }

  // ---------- NOTE ----------
  function renderNotes(){
    const box = $('#notes-list');
    if(!box) return;
    const data = store.load();
    const rows = [];
    for(const r of data){
      const arr = Array.isArray(r.notes) ? r.notes : [];
      for(const n of arr){
        rows.push({
          ch: r.channel,
          area: r.area,
          s: n.s || n.S || n.type || '',
          text: n.text || n.note || '',
          date: n.date || r.date || ''
        });
      }
    }
    rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
    if(!rows.length){ box.innerHTML = '<div class="muted">Nessuna nota importata.</div>'; return; }

    for(const n of rows){
      const el = document.createElement('div');
      el.className = 'note';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> • <span class="pill ${n.s?('s'+n.s[0]):''}">${n.s||''}</span></div>
          <div class="muted">${n.date}</div>
        </div>
        <div style="margin-top:.4rem">${(n.text||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>')}</div>`;
      box.appendChild(el);
    }
  }

  // ---------- Common ----------
  function initCommon(){
    const inp = $('#import-input');
    if(inp){
      // reset value per poter riaprire Importa subito dopo
      inp.onchange = ()=>{ handleImport(inp.files); inp.value=''; };
    }

    const exportFn = ()=>{
      const pin = prompt('Inserisci PIN (demo 1234):');
      if(pin!=='1234'){ alert('PIN errato'); return; }
      const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: 'SKF-5S-supervisor-archive.json'
      });
      a.click();
    };
    const exp1 = $('#btn-export'), exp2 = $('#btn-export-supervisor');
    if(exp1) exp1.onclick = exportFn;
    if(exp2) exp2.onclick = exportFn;

    const lock = $('#btn-lock');
    if(lock){
      let locked = sessionStorage.getItem('lock')==='1';
      const paint = ()=> lock.textContent = locked ? '🔓' : '🔒';
      paint();
      lock.onclick = ()=>{ locked=!locked; sessionStorage.setItem('lock', locked?'1':'0'); paint(); };
    }
  }

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    initCommon();
    render();
    if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
  });
})();
</script>
