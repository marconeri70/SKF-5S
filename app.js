// SKF 5S Supervisor — build 2.3.9 — correzione import note oggetto
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY = 'skf5s:pin';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const store = {
    load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
            catch(e){ console.warn(e); return []; } },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  const fmtPercent = v => `${Math.round(v)}%`;
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

  // --- Parser flessibile
  function parseRec(obj){
    const r = {
      area: obj.area || '',
      channel: obj.channel || obj.CH || obj.ch || '',
      date: obj.date || obj.timestamp || new Date().toISOString(),
      points: obj.points || obj.kpi || {},
      notes: []
    };
    r.points = {
      s1: Number(r.points.s1 || r.points.S1 || r.points['1S'] || 0),
      s2: Number(r.points.s2 || r.points.S2 || r.points['2S'] || 0),
      s3: Number(r.points.s3 || r.points.S3 || r.points['3S'] || 0),
      s4: Number(r.points.s4 || r.points.S4 || r.points['4S'] || 0),
      s5: Number(r.points.s5 || r.points.S5 || r.points['5S'] || 0)
    };

    // NOTE: se obj.notes è array
    if (Array.isArray(obj.notes)){
      r.notes = obj.notes.map(n => ({
        s: n.s || n.S || n.type || '',
        text: n.text || n.note || '',
        date: n.date || r.date
      }));
    }

    // NOTE: se obj.notes è oggetto {s1:"...", s2:"..."}
    else if (obj.notes && typeof obj.notes === 'object'){
      for (const key of Object.keys(obj.notes)){
        const val = obj.notes[key];
        if (typeof val === 'string' && val.trim()){
          const lines = val.split(/\n+/);
          for (const line of lines){
            r.notes.push({ s: key, text: line.trim(), date: r.date });
          }
        }
      }
    }

    // NOTE: se non ci sono, prova da S1...S5
    if (!r.notes.length){
      for (const k of Object.keys(obj)){
        if (/^S[1-5]$/i.test(k)){
          const arr = obj[k];
          if (Array.isArray(arr)){
            for (const line of arr){
              if (typeof line === 'string' && line.trim()){
                r.notes.push({ s: k, text: line.trim(), date: r.date });
              }
            }
          }
        }
      }
    }

    return r;
  }

  async function handleImport(files){
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));
    for (const f of files){
      try{
        const txt = await f.text();
        const rec = parseRec(JSON.parse(txt));
        if (!rec.channel) throw new Error('CH mancante');
        byKey.set(rec.area + '|' + rec.channel + '|' + rec.date, rec);
      }catch(e){ alert('Errore file ' + f.name); }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=> new Date(a.date)-new Date(b.date));
    store.save(merged);
    render();
  }

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

  function initLock(){
    const btn = $('#btn-lock'); if (!btn) return;
    const paint = () => {
      const pin = localStorage.getItem(PIN_KEY);
      btn.textContent = pin ? '🔓' : '🔒';
      btn.title = pin ? 'PIN impostato' : 'Imposta PIN';
    };
    paint();
    btn.onclick = () => {
      const old = localStorage.getItem(PIN_KEY);
      if (old){
        const chk = prompt('Inserisci PIN attuale:'); if (chk !== old){ alert('PIN errato'); return; }
        const n1 = prompt('Nuovo PIN:'); if (!n1) return;
        const n2 = prompt('Conferma nuovo PIN:'); if (n2 !== n1){ alert('Non coincide'); return; }
        localStorage.setItem(PIN_KEY, n1); alert('PIN aggiornato'); paint();
      } else {
        const n1 = prompt('Imposta PIN (demo 1234):'); if (n1) localStorage.setItem(PIN_KEY, n1);
        paint();
      }
    };
  }

  function renderHome(){
    const wrap = $('#board-all'); if (!wrap) return;
    const data = store.load();
    const type = $('.segmented .seg.on')?.dataset.type || 'all';
    const filtered = data.filter(r => type==='all' || r.area===type);

    const byCh = new Map();
    for (const r of filtered){ const k=r.channel; (byCh.get(k)||byCh.set(k,[]).get(k)).push(r); }

    wrap.innerHTML='';
    const chips = $('#chip-strip'); if (chips) chips.innerHTML='';

    for (const [ch, arr] of byCh){
      const last = arr.slice(-1)[0];
      const p = last.points;
      const div=document.createElement('div');
      div.className='board';
      div.innerHTML=`
        <h4>${ch} <small>${last.area}</small></h4>
        <div class="hbars">
          ${[1,2,3,4,5].map(i=>`<div class="hbar"><i class="l${i}" style="width:${p['s'+i]}%"></i><span class="pct">${fmtPercent(p['s'+i])}</span></div>`).join('')}
        </div>`;
      wrap.appendChild(div);

      const chip=document.createElement('button');
      chip.className='chip'; chip.textContent=ch;
      chip.onclick=()=>location.href='checklist.html#'+encodeURIComponent(ch);
      chips?.appendChild(chip);
    }

    $$('.segmented .seg').forEach(b=>{
      b.onclick=()=>{$$('.segmented .seg').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderHome();};
    });
  }

  function renderChecklist(){
    const wrap=$('#cards'); if(!wrap) return;
    const data=store.load();
    wrap.innerHTML='';
    for(const r of data){
      const p=r.points;
      const card=document.createElement('div');
      card.className='card-line';
      card.innerHTML=`
        <div class="top">
          <div><b>${r.channel}</b> • ${r.area}</div>
          <div class="pills">
            ${[1,2,3,4,5].map(i=>`<span class="pill s${i}">S${i} ${fmtPercent(p['s'+i])}</span>`).join('')}
          </div>
        </div>`;
      wrap.appendChild(card);
    }
    $('#btn-toggle-all')?.addEventListener('click',()=>{
      const c=$$('.card-line');const compact=!c[0]?.classList.contains('compact');
      c.forEach(e=>e.classList.toggle('compact',compact));
    });
  }

  function renderNotes(){
    const box=$('#notes-list'); if(!box) return;
    const rows=[];
    for(const r of store.load()){
      for(const n of r.notes){ rows.push({ch:r.channel,area:r.area,s:n.s,text:n.text,date:n.date}); }
    }
    box.innerHTML='';
    for(const n of rows){
      const el=document.createElement('div');
      const S=(n.s||'').replace(/\D/g,'')||'1';
      el.className='note';
      el.innerHTML=`<div><b>${n.ch}</b> • <span class="pill s${S}">S${S}</span> ${n.area}</div><div class="muted">${n.date}</div><p>${n.text}</p>`;
      box.appendChild(el);
    }
    $('#notes-count')?.textContent='('+rows.length+')';
  }

  function initCommon(){
    $('#btn-import')?.addEventListener('click',()=>$('#import-input')?.click());
    $('#import-input')?.addEventListener('change',e=>handleImport(e.target.files));
    $('#btn-export')?.addEventListener('click',exportAll);
    $('#btn-export-supervisor')?.addEventListener('click',exportAll);
    $('#btn-notes')?.addEventListener('click',()=>location.href='notes.html');
  }

  function render(){renderHome();renderChecklist();renderNotes();}
  window.addEventListener('DOMContentLoaded',()=>{initCommon();initLock();render();});
})();
