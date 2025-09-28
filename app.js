// SKF 5S Supervisor — single JS for all pages
(()=>{
  const STORAGE_KEY='skf5s:supervisor:data';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  const store={
    load(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch(e){return[]} },
    save(a){ localStorage.setItem(STORAGE_KEY, JSON.stringify(a)) }
  };

  async function handleImport(files){
    if(!files || !files.length) return;
    const now = store.load();
    const map = new Map(now.map(r=>[(r.area||'')+'|'+(r.channel||'')+'|'+(r.date||''), r]));
    let imported=0;
    for(const f of files){
      try{
        const rec = JSON.parse(await f.text());
        if(rec && rec.area && rec.channel && rec.points){
          const key=(rec.area||'')+'|'+(rec.channel||'')+'|'+(rec.date||'');
          map.set(key, rec);
          imported++;
        }else{
          alert('File non valido: '+f.name);
        }
      }catch(e){ alert('Errore lettura: '+f.name); }
    }
    const merged=[...map.values()].sort((a,b)=> String(a.channel).localeCompare(String(b.channel)));
    store.save(merged);
    if(imported) alert(`Import completato: ${imported} file, ${merged.length} record totali`);
    render();
  }

  function renderBars(el, values){
    if(!el) return;
    el.innerHTML='';
    const max=Math.max(100, ...values);
    ['1S','2S','3S','4S','5S'].forEach((lab,i)=>{
      const v=values[i]||0;
      const d=document.createElement('div');
      d.className='bar s'+(i+1);
      d.style.height = Math.round(v/max*100)+'%';
      const sp=document.createElement('span'); sp.textContent=lab;
      d.appendChild(sp); el.appendChild(d);
    });
  }

  function renderHome(){
    const boards=$('#boards'); if(!boards) return;
    const chips=$('#chip-strip');
    boards.innerHTML=''; chips.innerHTML='';

    const data=store.load();
    const byCh=new Map();
    for(const r of data){
      const key=r.channel||'CH';
      (byCh.get(key)||byCh.set(key,[]).get(key)).push(r);
    }
    // Chips + Boards
    for(const [ch,arr] of byCh){
      const last=arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const card=document.createElement('div');
      card.className='board';
      card.innerHTML=`<h3>${ch} <small class="muted">${last?.area||''}</small></h3>
        <div class="chart" id="chart-${CSS.escape(ch)}"></div>
        <div class="muted small">Ultimo: ${last?.date||'-'}</div>
        <div style="display:flex;gap:.5rem;margin-top:.4rem">
          <a class="btn" href="checklist.html#${encodeURIComponent(ch)}">Apri in checklist</a>
          <button class="btn" onclick="window.print()">Stampa PDF</button>
        </div>`;
      boards.appendChild(card);
      const vals=[last?.points?.s1||0,last?.points?.s2||0,last?.points?.s3||0,last?.points?.s4||0,last?.points?.s5||0];
      renderBars($('#chart-'+CSS.escape(ch)), vals);

      const chip=document.createElement('button');
      chip.className='chip'; chip.textContent=ch;
      chip.onclick=()=>location.href='checklist.html#'+encodeURIComponent(ch);
      chips.appendChild(chip);
    }
  }

  function renderChecklist(){
    const wrap=$('#cards'); if(!wrap) return;
    const data=store.load();
    const byCh=new Map();
    for(const r of data){
      const key=r.channel||'CH';
      (byCh.get(key)||byCh.set(key,[]).get(key)).push(r);
    }
    wrap.innerHTML='';
    for(const [ch,arr] of byCh){
      const last=arr.sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p=last?.points||{s1:0,s2:0,s3:0,s4:0,s5:0};
      const avg=Math.round((p.s1+p.s2+p.s3+p.s4+p.s5)/5);
      const card=document.createElement('div'); card.className='card-line';
      card.innerHTML=`
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${ch}</div>
            <div class="muted small">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${p.s1}%</span>
            <span class="pill s2">S2 ${p.s2}%</span>
            <span class="pill s3">S3 ${p.s3}%</span>
            <span class="pill s4">S4 ${p.s4}%</span>
            <span class="pill s5">S5 ${p.s5}%</span>
          </div>
          <div class="kpi"><span class="badge">Voto medio ${avg}%</span></div>
          <div><button class="btn" onclick="window.print()">Stampa PDF</button></div>
        </div>`;
      wrap.appendChild(card);
    }

    const toggle=$('#toggle-all');
    if(toggle){
      let collapsed=false;
      toggle.onclick=()=>{
        collapsed=!collapsed;
        $$('.card-line .pills').forEach(el=> el.style.display=collapsed?'none':'flex');
      };
    }
  }

  function renderNotes(){
    const box=$('#notes-list'); if(!box) return;
    const data=store.load();
    const rows=[];
    for(const r of data){
      const arr=Array.isArray(r.notes)?r.notes:[];
      for(const n of arr){
        rows.push({ch:r.channel, area:r.area, s:n.s||n.S||n.type||'', text:n.text||n.note||'', date:n.date||r.date||''});
      }
    }
    const counter=$('#count-notes'); if(counter) counter.textContent=`${rows.length} note`;
    box.innerHTML='';
    if(!rows.length){ box.innerHTML='<div class="muted">Nessuna nota importata.</div>'; return; }
    rows.sort((a,b)=>new Date(b.date)-new Date(a.date));
    for(const n of rows){
      const el=document.createElement('div'); el.className='note';
      el.innerHTML=`<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
        <div><strong>${n.ch}</strong> • <span class="pill ${n.s?('s'+n.s[0]):''}">${n.s||''}</span></div>
        <div class="muted small">${n.date}</div></div>
        <div style="margin-top:.4rem;white-space:pre-wrap">${n.text||''}</div>`;
      box.appendChild(el);
    }
  }

  function exportWithPin(){
    const pin=prompt('Inserisci PIN (demo 1234):');
    if(pin!=='1234'){ alert('PIN errato'); return; }
    const blob=new Blob([JSON.stringify(store.load(),null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='SKF-5S-supervisor-archive.json'; a.click();
  }

  function initLock(){
    const btn=$('#btn-lock'); if(!btn) return;
    let locked=sessionStorage.getItem('lock')==='1';
    const paint=()=> btn.textContent = locked?'🔓':'🔒';
    paint();
    btn.onclick=()=>{ locked=!locked; sessionStorage.setItem('lock',locked?'1':'0'); paint(); };
  }

  function initCommon(){
    const input=$('#import-input'); if(input) input.onchange=()=>handleImport(input.files);
    const exp=$('#btn-export'); if(exp) exp.onclick=exportWithPin;
    const exp2=$('#btn-export-supervisor'); if(exp2) exp2.onclick=exportWithPin;
  }

  function render(){
    renderHome(); renderChecklist(); renderNotes();
  }

  window.addEventListener('DOMContentLoaded',()=>{
    initCommon(); initLock(); render();
    if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
  });
})();