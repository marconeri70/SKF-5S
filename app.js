// SKF 5S — Supervisor bundle (no external deps).
// Data model in localStorage: key 'skf5s_archive'.
// Each entry: { area, channel, date, points:{s1..s5}, notes:[{s:'1S'..'5S', text, date, late?:true}] }

(function(){
  const KEY = 'skf5s_archive';
  const PIN = 'SKF5S'; // change if needed

  const q = (sel, root=document) => root.querySelector(sel);
  const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function load(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ return []; }
  }
  function save(arr){
    localStorage.setItem(KEY, JSON.stringify(arr));
  }

  // Merge entries by (area, channel, date). New overwrites fields; notes are concatenated de-duplicated.
  function mergeData(current, incoming){
    const sig = e => `${e.area}||${e.channel}||${e.date}`;
    const map = new Map(current.map(e => [sig(e), JSON.parse(JSON.stringify(e))]));
    for(const e of incoming){
      const k = sig(e);
      const copy = JSON.parse(JSON.stringify(e));
      if(map.has(k)){
        const base = map.get(k);
        base.points = Object.assign({}, base.points, copy.points);
        base.notes = dedupNotes((base.notes||[]).concat(copy.notes||[]));
        map.set(k, base);
      } else {
        copy.notes = dedupNotes(copy.notes||[]);
        map.set(k, copy);
      }
    }
    return Array.from(map.values());
  }
  function dedupNotes(arr){
    const seen = new Set();
    const out = [];
    for(const n of arr){
      const k = `${n.s}||${n.date||''}||${(n.text||'').trim()}`;
      if(!seen.has(k)){ seen.add(k); out.push(n); }
    }
    return out;
  }

  function aggregate(archive){
    // Returns global stats + byChannel map
    const byCh = {};
    for(const e of archive){
      const ch = e.channel;
      if(!byCh[ch]) byCh[ch] = { area:e.area, points:[], notes:[] };
      byCh[ch].points.push(e.points || {});
      if(e.notes) byCh[ch].notes.push(...e.notes);
    }
    // avg helpers
    const avg = ns => ns.length? Math.round(ns.reduce((a,b)=>a+b,0)/ns.length) : 0;
    const sAvg = (arr, key) => avg(arr.map(p => Number(p[key]||0)));
    const chStats = {};
    Object.keys(byCh).forEach(ch=>{
      const list = byCh[ch].points;
      chStats[ch] = {
        area: byCh[ch].area,
        s1: sAvg(list,'s1'), s2: sAvg(list,'s2'), s3: sAvg(list,'s3'),
        s4: sAvg(list,'s4'), s5: sAvg(list,'s5'),
        notes: byCh[ch].notes
      };
    });
    const channels = Object.keys(chStats);
    const kpiLines = channels.length;
    const globalAvg = channels.length ?
      Math.round(channels.reduce((a,ch)=> a + (chStats[ch].s1+chStats[ch].s2+chStats[ch].s3+chStats[ch].s4+chStats[ch].s5)/5, 0) / channels.length)
      : 0;
    const late = archive.reduce((acc,e)=>acc + (e.notes||[]).filter(n=>n.late).length, 0);
    const s1 = avg(channels.map(ch=>chStats[ch].s1));
    const s2 = avg(channels.map(ch=>chStats[ch].s2));
    const s3 = avg(channels.map(ch=>chStats[ch].s3));
    const s4 = avg(channels.map(ch=>chStats[ch].s4));
    const s5 = avg(channels.map(ch=>chStats[ch].s5));
    return {kpiLines, globalAvg, late, bars:[s1,s2,s3,s4,s5], chStats};
  }

  function drawBars(el, values){
    // simple SVG bar chart
    const labels = ['1S','2S','3S','4S','5S'];
    const colors = ['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)'];
    const W = el.clientWidth || 700, H = 240, pad = 28;
    const bw = (W - pad*2) / (values.length*1.4);
    const gap = bw*0.4;
    const max = 100;
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    // grid
    for(let i=0;i<=4;i++){
      const y = pad + i*(H-2*pad)/4;
      svg += `<line x1="${pad}" y1="${y}" x2="${W-pad}" y2="${y}" stroke="rgba(255,255,255,.15)" stroke-width="1"/>`;
    }
    // bars
    let x = pad;
    values.forEach((v, i)=>{
      const h = ((H-2*pad) * v) / max;
      const y = H - pad - h;
      svg += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${colors[i]}" rx="6"/>`;
      svg += `<text x="${x+bw/2}" y="${y-6}" fill="#fff" font-size="12" text-anchor="middle">${v}%</text>`;
      svg += `<text x="${x+bw/2}" y="${H-pad+16}" fill="#d9e4ff" font-size="12" text-anchor="middle">${labels[i]}</text>`;
      x += bw + gap;
    });
    svg += `</svg>`;
    el.innerHTML = svg;
  }

  function ensureSW(){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }
  }

  // PUBLIC API
  window.SKF5S = {
    renderHome(){
      ensureSW();
      const data = load();
      const agg = aggregate(data);
      const set = (id, val)=>{ const el = document.getElementById(id); if(el) el.textContent = val; };
      set('kpiLines', agg.kpiLines);
      set('kpiAvg', `${agg.globalAvg}%`);
      set('kpiLate', agg.late);
      drawBars(document.getElementById('chart'), agg.bars);
      // chips
      const chipsEl = document.getElementById('chips');
      chipsEl.innerHTML = '';
      Object.keys(agg.chStats).forEach(ch=>{
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = ch;
        chip.addEventListener('click', ()=>{
          // jump to checklist and anchor by CH
          location.href = `checklist.html#${encodeURIComponent(ch)}`;
        });
        chipsEl.appendChild(chip);
      });
    },

    initImportUI(){
      ensureSW();
      const fileInput = q('#fileInput');
      const cards = q('#cards');
      // render cards
      function render(){
        const archive = load();
        const agg = aggregate(archive);
        cards.innerHTML = '';
        Object.keys(agg.chStats).sort().forEach(ch=>{
          const st = agg.chStats[ch];
          const card = document.createElement('div');
          card.className = 'card';
          card.id = ch;
          card.innerHTML = `
            <div class="card-header">
              <div class="card-title">${ch} <span class="muted">— ${st.area||''}</span></div>
              <div class="badges">
                <span class="badge s1">1S ${st.s1}%</span>
                <span class="badge s2">2S ${st.s2}%</span>
                <span class="badge s3">3S ${st.s3}%</span>
                <span class="badge s4">4S ${st.s4}%</span>
                <span class="badge s5">5S ${st.s5}%</span>
              </div>
            </div>
            <div class="card-body">
              ${renderDetailsTable(ch, archive)}
            </div>`;
          card.querySelector('.card-header').addEventListener('click', ()=> card.classList.toggle('open'));
          cards.appendChild(card);
        });
        // open anchor if any
        if(location.hash){
          const id = decodeURIComponent(location.hash.slice(1));
          const el = document.getElementById(id);
          if(el){ el.classList.add('open'); el.scrollIntoView({behavior:'smooth', block:'start'}); }
        }
      }
      function renderDetailsTable(ch, archive){
        const rows = archive.filter(e=>e.channel===ch).sort((a,b)=> String(a.date).localeCompare(String(b.date)));
        const tr = rows.map(e=>{
          const p=e.points||{};
          return `<tr>
            <td>${e.date||''}</td>
            <td>${p.s1||0}%</td><td>${p.s2||0}%</td><td>${p.s3||0}%</td><td>${p.s4||0}%</td><td>${p.s5||0}%</td>
            <td>${(e.notes||[]).length}</td>
          </tr>`;
        }).join('');
        return `<table class="table">
          <thead><tr><th>Data</th><th>1S</th><th>2S</th><th>3S</th><th>4S</th><th>5S</th><th>Note</th></tr></thead>
          <tbody>${tr||''}</tbody>
        </table>
        <p><a class="btn" href="notes.html">Apri note</a></p>`;
      }

      fileInput.addEventListener('change', async (ev)=>{
        const files = Array.from(ev.target.files||[]);
        if(!files.length) return;
        let incoming = [];
        for(const f of files){
          try{
            const text = await f.text();
            const js = JSON.parse(text);
            // Accept single object or array
            const arr = Array.isArray(js) ? js : [js];
            // Normalize
            for(const it of arr){
              incoming.push({
                area: it.area || it.Area || it.zone || 'Area',
                channel: it.channel || it.CH || it.line || 'CH',
                date: it.date || it.Data || it.dateISO || it.updatedAt || new Date().toISOString().slice(0,10),
                points: {
                  s1: Number((it.points&&it.points.s1) ?? it.s1 ?? 0),
                  s2: Number((it.points&&it.points.s2) ?? it.s2 ?? 0),
                  s3: Number((it.points&&it.points.s3) ?? it.s3 ?? 0),
                  s4: Number((it.points&&it.points.s4) ?? it.s4 ?? 0),
                  s5: Number((it.points&&it.points.s5) ?? it.s5 ?? 0),
                },
                notes: (it.notes||it.note||[]).map(n=> (typeof n==='string') ? {s:'', text:n} : n)
              });
            }
          }catch(e){ console.warn('File JSON ignorato', f.name, e); }
        }
        const merged = mergeData(load(), incoming);
        save(merged);
        render();
        // small toast
        alert(`Import completato: ${incoming.length} record`);
        // also refresh home KPI if open in another tab will reflect on reload.
      });

      render();
    },

    renderNotes(){
      ensureSW();
      const target = q('#notes');
      const archive = load();
      const all = [];
      for(const e of archive){
        for(const n of (e.notes||[])){
          all.push({
            ch: e.channel, area: e.area, s: n.s || '?S', date: n.date || e.date || '',
            text: n.text || '', late: !!n.late
          });
        }
      }
      all.sort((a,b)=> String(b.date).localeCompare(String(a.date)) || String(a.ch).localeCompare(String(b.ch)));
      const rows = all.map(n=> `<tr>
          <td><strong>${n.ch}</strong><br/><span class="muted">${n.area}</span></td>
          <td>${n.s}</td><td>${n.date||''}</td>
          <td>${n.text? n.text.replace(/[<>&]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) : ''}</td>
          <td>${n.late? '⏰' : ''}</td>
      </tr>`).join('');
      target.innerHTML = `<table class="table">
        <thead><tr><th>CH</th><th>S</th><th>Data</th><th>Nota</th><th>Ritardo</th></tr></thead>
        <tbody>${rows||''}</tbody>
      </table>`;
    },

    exportArchivePIN(){
      const code = prompt('Inserisci PIN per esportare','');
      if(code!==PIN){ alert('PIN errato'); return; }
      const data = load();
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SKF5S-supervisor-archive.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 300);
    }
  };
})();
