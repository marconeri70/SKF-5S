/* ===================== SKF 5S – app.js (v7.10.2) ========================= */
const VERSION = 'v7.10.2';
const STORE   = 'skf.5s.v7.10.2';
const CHART_STORE = STORE + '.chart';
const POINTS = [0,1,3,5];

// Voc (estratto da Excel)
const VOC_1S=[{t:"Zona pedonale pavimento",d:"Area pedonale libera da congestione/ostacoli e pericoli di inciampo"},
{t:"Zona di lavoro (pavimento, macchina)",d:"Solo il necessario per l’ordine in corso"},
{t:"Materiali",d:"Materiale non necessario rimosso/segregato"},
{t:"Informazioni",d:"Documenti necessari e in buono stato"},
{t:"Processo di etichettatura",d:"Gestione etichette rosse / scarti definita"},
{t:"Piano per sostenere il risultato",d:"Lavagna 5S, foto prima/dopo, azioni, punteggi, SPL"}];
const VOC_2S=[{t:"1-S Stato",d:"Team e area definiti, 1S mantenuta"},
{t:"Sicurezza",d:"Dispositivi/attrezzature identificati e accessibili"},
{t:"Qualità",d:"Postazioni qualità ordinate e chiare"},
{t:"Documenti",d:"Documenti al punto d’uso e aggiornati"},
{t:"Concetti",d:"Ergonomia, punto d’uso, zero sprechi/confusione"},
{t:"Posizioni prefissate",d:"Sagome/posti fissi: facile capire cosa manca"},
{t:"Visual Management di base",d:"Linee/etichette/colori minimi attivi"}];
const VOC_3S=[{t:"1-S Stato",d:"1S mantenuta"},
{t:"2-S Stato",d:"2S mantenuta"},
{t:"Pulizia",d:"Aree e macchine pulite (anche punti difficili)"},
{t:"Misure preventive",d:"Cause di sporco/perdite rimosse alla radice"},
{t:"Pulire è routine",d:"Routine con responsabilità e frequenze"},
{t:"Standard di pulizia",d:"Standard e checklist visibili e seguiti"}];
const VOC_4S=[{t:"Aree di passaggio",d:"Nessun deposito/ostacolo; pavimento libero"},
{t:"Area di lavoro",d:"Solo il necessario per l’ordine corrente"},
{t:"Materiali",d:"Materiali corretti e identificati"},
{t:"Informazione",d:"Info necessarie e in buono stato"},
{t:"Visual Management",d:"Indicatori visivi efficaci in routine"},
{t:"Posizioni prefissate",d:"Prelievo/rimessa facili e immediati"},
{t:"Standard lavoro & check",d:"SPL/istruzioni/checklist visibili e usate"},
{t:"Etichette e colori",d:"Etichette chiare, codici colore coerenti"},
{t:"Marcature tubi/valvole",d:"Tubi/valvole/strumenti marcati (colori standard)"},
{t:"Segnaletica a terra",d:"Linee/campiture presenti e mantenute"},
{t:"Punti di ispezione",d:"Chiari i punti e cosa controllare"},
{t:"Single Point Lessons",d:"SPL aggiornate e usate"},
{t:"Standard & documentazione",d:"Documentazione aggiornata/disponibile"},
{t:"Kanban & scorte",d:"Gestione consumabili visiva (min/max)"},
{t:"Misure preventive",d:"Anomalie risolte alla radice"}];
const VOC_5S=[{t:"Ognuno & ogni giorno",d:"Tutti formati e coinvolti sugli standard"},
{t:"Miglioramento continuo",d:"Evidenza prima/dopo; standard aggiornati"}];

// Helpers
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const todayISO=()=>new Date().toISOString().slice(0,10);
const isOverdue=d=>d && new Date(d+'T23:59:59')<new Date();
const pct=n=>Math.round(n*100)+'%';

// Costruzione strutture
function makeS(v){return {"1S":v[0].map(c=>({...c,p:0,resp:"",due:"",note:""})),
                           "2S":v[1].map(c=>({...c,p:0,resp:"",due:"",note:""})),
                           "3S":v[2].map(c=>({...c,p:0,resp:"",due:"",note:""})),
                           "4S":v[3].map(c=>({...c,p:0,resp:"",due:"",note:""})),
                           "5S":v[4].map(c=>({...c,p:0,resp:"",due:"",note:""}))}; }
function makeSectorSet(){return makeS([VOC_1S,VOC_2S,VOC_3S,VOC_4S,VOC_5S]);}
function makeArea(line){return{line,sectors:{Rettifica:makeSectorSet(),Montaggio:makeSectorSet()}};}

// Storage
function load(){try{const raw=localStorage.getItem(STORE);return raw?JSON.parse(raw):{areas:[]}}catch{return{areas:[]}}}
function save(){localStorage.setItem(STORE,JSON.stringify(state))}
function loadChartPref(){try{return JSON.parse(localStorage.getItem(CHART_STORE))||{zoom:1,stacked:false,scroll:0}}catch{return{zoom:1,stacked:false,scroll:0}}}
function saveChartPref(){localStorage.setItem(CHART_STORE,JSON.stringify(chartPref))}

// Stato UI
let state=load(); if(!state.areas?.length){state.areas=[makeArea('L2')]; save();}
let ui={q:'',line:'ALL',sector:'ALL',onlyLate:false};
let chartPref=loadChartPref(); // {zoom, stacked, scroll}

// Bind base
const elAreas=$('#areas'), elLineFilter=$('#lineFilter'), elQ=$('#q'), elOnlyLate=$('#onlyLate');
const tplArea=$('#tplArea'), tplItem=$('#tplItem');
const elKpiAreas=$('#kpiAreas'), elKpiScore=$('#kpiScore'), elKpiLate=$('#kpiLate');

// Tema
const btnTheme=$('#btnTheme');
if(localStorage.getItem('theme')==='dark') document.documentElement.classList.add('dark');
btnTheme?.addEventListener('click',()=>{
  const root=document.documentElement;
  root.classList.toggle('dark');
  localStorage.setItem('theme',root.classList.contains('dark')?'dark':'light');
});

// Topbar
$('#btnNewArea')?.addEventListener('click',()=>{
  const line=(prompt('Nuova linea? (es. L3)','L3')||'Lx').trim();
  if(!line) return;
  state.areas.push(makeArea(line)); save(); render();
});
$('#btnExport')?.addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`SKF_5S_${todayISO()}.json`});
  document.body.appendChild(a); a.click(); a.remove();
});
$('#fileImport')?.addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{ state=JSON.parse(await f.text()); save(); render(); }catch{ alert('File non valido'); }
});
$('#btnPrint')?.addEventListener('click',()=>window.print());

// Filtri
$('#btnAll')?.addEventListener('click',()=>{ui.sector='ALL'; setSeg('#btnAll'); render();});
$('#btnFgr')?.addEventListener('click',()=>{ui.sector='Rettifica'; setSeg('#btnFgr'); render();});
$('#btnAsm')?.addEventListener('click',()=>{ui.sector='Montaggio'; setSeg('#btnAsm'); render();});
function setSeg(sel){['#btnAll','#btnFgr','#btnAsm'].forEach(s=>$(s)?.classList.remove('active')); $(sel)?.classList.add('active');}
elQ?.addEventListener('input',()=>{ui.q=elQ.value; render();});
elOnlyLate?.addEventListener('change',()=>{ui.onlyLate=elOnlyLate.checked; render();});
$('#btnClearFilters')?.addEventListener('click',()=>{
  ui={q:'',line:'ALL',sector:'ALL',onlyLate:false};
  elQ.value=''; elOnlyLate.checked=false; elLineFilter.value='ALL'; setSeg('#btnAll'); render();
});
elLineFilter?.addEventListener('change',()=>{ui.line=elLineFilter.value; render();});

// Chart toolbar
$('#zoomIn')?.addEventListener('click',()=>{chartPref.zoom=Math.min(2.5, +(chartPref.zoom+0.1).toFixed(2)); saveChartPref(); drawChart();});
$('#zoomOut')?.addEventListener('click',()=>{chartPref.zoom=Math.max(0.6, +(chartPref.zoom-0.1).toFixed(2)); saveChartPref(); drawChart();});
$('#toggleStacked')?.addEventListener('change',e=>{chartPref.stacked=e.target.checked; saveChartPref(); drawChart();});

// Render base
function render(){
  document.getElementById('appVersion')?.replaceChildren(VERSION);
  refreshLineFilter();
  const list=filteredAreas();
  elAreas.innerHTML='';
  list.forEach(a=>elAreas.appendChild(renderArea(a)));
  updateDashboard(list);
  drawChart(list);
  buildLineButtons(list);
}
function refreshLineFilter(){
  const lines=Array.from(new Set(state.areas.map(a=>(a.line||'').trim()).filter(Boolean))).sort();
  elLineFilter.innerHTML=`<option value="ALL">Linea: Tutte</option>` + lines.map(l=>`<option value="${l}">${l}</option>`).join('');
  if(!lines.includes(ui.line)) ui.line='ALL'; elLineFilter.value=ui.line;
}
function filteredAreas(){
  const q=(ui.q||'').toLowerCase();
  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
  return state.areas.filter(a=>{
    if(ui.line!=='ALL' && (a.line||'').trim()!==ui.line) return false;
    if(!q && !ui.onlyLate) return true;
    let ok=false;
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach(it=>{
      if(ui.onlyLate && !isOverdue(it.due)) return;
      if(!q){ ok=true; return; }
      const bag=`${it.t||''} ${it.note||''} ${it.resp||''}`.toLowerCase();
      if(bag.includes(q)) ok=true;
    })));
    return ok;
  });
}
function computeByS(area,sector){
  const secs=sector==='ALL'?['Rettifica','Montaggio']:[sector];
  const perS={"1S":{s:0,m:0},"2S":{s:0,m:0},"3S":{s:0,m:0},"4S":{s:0,m:0},"5S":{s:0,m:0}};
  let sum=0,max=0;
  secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(area.sectors[sec][S]||[]).forEach(it=>{
    perS[S].s+=(+it.p||0); perS[S].m+=5; sum+=(+it.p||0); max+=5;
  })));
  const byS={}; Object.keys(perS).forEach(S=>byS[S]=perS[S].m?perS[S].s/perS[S].m:0);
  return {byS, total:max?sum/max:0};
}

// Render area
function renderArea(area){
  const node=tplArea.content.firstElementChild.cloneNode(true);
  const line=$('.area-line',node), scoreEl=$('.score-val',node);
  const secTabs=$$('.tab.sec',node), sTabs=$$('.tab.s',node), panels=$$('.panel',node);

  let curSector=(ui.sector==='ALL'?'Rettifica':ui.sector), curS='1S';

  line.value=area.line||''; 
  line.addEventListener('input',()=>{area.line=line.value.trim(); save(); refreshLineFilter(); buildLineButtons();});

  // Settori
  secTabs.forEach(b=>{
    if(b.dataset.sector===curSector) b.classList.add('active');
    b.addEventListener('click',()=>{secTabs.forEach(x=>x.classList.remove('active')); b.classList.add('active'); curSector=b.dataset.sector; refill(); updateScore();});
  });

  // Tab S
  sTabs.forEach(t=> t.addEventListener('click',()=>{
    sTabs.forEach(x=>x.classList.remove('active'));
    t.classList.add('active'); curS=t.dataset.s;
    panels.forEach(p=>p.classList.toggle('active',p.dataset.s===curS));
  }));

  // Aggiungi voce
  $('.add-item',node).addEventListener('click',()=>{
    area.sectors[curSector][curS].push({t:"",d:"",p:0,resp:"",due:"",note:""}); save(); refill(); updateScore();
  });

  // Comprimi / Espandi (fix)
  const btnCol=$('.collapse',node);
  const setCol=()=>{btnCol.textContent=node.classList.contains('collapsed')?'Espandi':'Comprimi'};
  btnCol.addEventListener('click',()=>{node.classList.toggle('collapsed'); setCol();});
  setCol();

  // Elimina
  $('.delete-area',node).addEventListener('click',()=>{
    if(!confirm('Eliminare la linea?')) return;
    state.areas.splice(state.areas.indexOf(area),1); save(); render();
  });

  function refill(){
    panels.forEach(p=>{
      const S=p.dataset.s; p.innerHTML='';
      (area.sectors[curSector][S]||[]).forEach((it,i)=> p.appendChild(renderItem(area,curSector,S,i,it)));
      p.classList.toggle('active',S===curS);
    });
    const {byS}=computeByS(area,curSector);
    $('.score-1S',node).textContent=pct(byS['1S']);
    $('.score-2S',node).textContent=pct(byS['2S']);
    $('.score-3S',node).textContent=pct(byS['3S']);
    $('.score-4S',node).textContent=pct(byS['4S']);
    $('.score-5S',node).textContent=pct(byS['5S']);
  }
  function updateScore(){ scoreEl.textContent=pct(computeByS(area,curSector).total); }

  refill(); updateScore();
  return node;
}

function renderItem(area, sector, S, idx, it){
  const frag=document.createDocumentFragment();
  const node=tplItem.content.firstElementChild.cloneNode(true);
  const desc=tplItem.content.children[1].cloneNode(true);

  const txt=$('.txt',node), resp=$('.resp',node), due=$('.due',node), note=$('.note',node);
  const dots=$$('.points-dots .dot',node);

  txt.value=it.t||''; resp.value=it.resp||''; due.value=it.due||''; note.value=it.note||'';
  desc.innerHTML = `<b>${it.t||''}</b><br>${it.d||''}`;

  const syncDots=()=>dots.forEach(d=>d.classList.toggle('active', +d.dataset.val === (+it.p||0)));
  syncDots(); node.classList.toggle('late', isOverdue(it.due));

  txt.addEventListener('input', ()=>{it.t=txt.value; desc.innerHTML=`<b>${it.t||''}</b><br>${it.d||''}`; save();});
  resp.addEventListener('input',()=>{it.resp=resp.value; save();});
  note.addEventListener('input',()=>{it.note=note.value; save();});
  due.addEventListener('change',()=>{it.due=due.value; save(); node.classList.toggle('late',isOverdue(it.due)); updateDashboard();});

  dots.forEach(d=> d.addEventListener('click',()=>{
    it.p = +d.dataset.val; syncDots(); save(); updateDashboard(); drawChart(); buildLineButtons();
  }));

  $('.info',node).addEventListener('click',()=>{
    const v = desc.style.display !== 'block';
    desc.style.display = v ? 'block' : 'none';
  });

  $('.del',node).addEventListener('click',()=>{
    const arr=area.sectors[sector][S]; arr.splice(idx,1); save(); render();
  });

  frag.appendChild(node); frag.appendChild(desc); return frag;
}

// Dashboard / late
function overallStats(list){
  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
  let sum=0,max=0,late=0;
  (list||filteredAreas()).forEach(a=>{
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach(it=>{
      sum+=(+it.p||0); max+=5; if(isOverdue(it.due)) late++;
    })));
  });
  return {score:max?sum/max:0, late};
}
function updateDashboard(list){
  const {score,late}=overallStats(list);
  elKpiAreas.textContent=(list||filteredAreas()).length;
  elKpiScore.textContent=pct(score);
  elKpiLate.textContent=late;
  renderLateList(list);
}
function renderLateList(list){
  const host=$('#lateList'); host.innerHTML='';
  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
  const arr=[];
  (list||filteredAreas()).forEach(a=>{
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach((it,idx)=>{
      if(isOverdue(it.due)) arr.push({line:a.line||'—',sector:sec,S,idx,title:it.t||'(senza titolo)',due:it.due});
    })));
  });
  if(!arr.length){host.style.display='none'; return;}
  host.style.display='flex';
  arr.forEach(x=>{
    const b=document.createElement('button');
    b.className='late-chip';
    b.innerHTML=`<span class="meta">${x.line} · ${x.sector} · ${x.S}</span> — ${x.title} · scad. ${x.due}`;
    b.addEventListener('click',()=>focusLate(x));
    host.appendChild(b);
  });
}
function focusLate(x){
  const card=[...document.querySelectorAll('.area')].find(a => a.querySelector('.area-line')?.value.trim()===(x.line||'').trim());
  if(!card) return;
  // settore
  const secBtn=[...card.querySelectorAll('.tab.sec')].find(b=>b.dataset.sector===x.sector);
  secBtn?.click();
  // S
  const sBtn=[...card.querySelectorAll('.tab.s')].find(b=>b.dataset.s===x.S);
  sBtn?.click();
  card.scrollIntoView({behavior:'smooth', block:'start'});
  const panel=card.querySelector(`.panel[data-s="${x.S}"]`);
  const item=panel?.querySelectorAll('.item')[x.idx];
  if(item){ item.classList.remove('flash'); void item.offsetWidth; item.classList.add('flash'); }
}

// CHART (scroll, zoom, stacked/clustered, scroll memory)
function drawChart(list){
  const canvas = document.getElementById('chartAreas');
  const wrap   = canvas?.closest('.chart-inner');
  const scroller = canvas?.closest('.chart-scroll');
  if(!canvas || !wrap) return;

  // controlli UI
  $('#toggleStacked').checked = !!chartPref.stacked;

  const DPR  = window.devicePixelRatio || 1;
  const Hcss = 260;

  const areas = (list || filteredAreas());
  const css = getComputedStyle(document.documentElement);
  const GRID = css.getPropertyValue('--outline')||'#d0d7e1';
  const TXT  = css.getPropertyValue('--text')||'#003366';
  const C1=css.getPropertyValue('--c1').trim(), C2=css.getPropertyValue('--c2').trim(),
        C3=css.getPropertyValue('--c3').trim(), C4=css.getPropertyValue('--c4').trim(),
        C5=css.getPropertyValue('--c5').trim();

  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];

  const rows=areas.map(a=>{
    let perS={"1S":{s:0,m:0},"2S":{s:0,m:0},"3S":{s:0,m:0},"4S":{s:0,m:0},"5S":{s:0,m:0}}, t={s:0,m:0};
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach(it=>{
      perS[S].s+=(+it.p||0); perS[S].m+=5; t.s+=(+it.p||0); t.m+=5;
    })));
    const byS={}; Object.keys(perS).forEach(S=>byS[S]=perS[S].m?perS[S].s/perS[S].m:0);
    return {line:a.line||'—', byS, tot:t.m?t.s/t.m:0};
  }).sort((a,b)=>a.line.localeCompare(b.line));

  // geometria
  const padL=56, padR=16, padT=12, padB=46;
  const bwBase=14, innerBase=4, gapBase=18;
  const z = chartPref.zoom || 1;
  const bw = Math.max(8, bwBase*z), inner=Math.max(3, innerBase*z), gap=Math.max(12, gapBase*z);
  const plotH = Hcss - padT - padB;

  let totalW;
  if(chartPref.stacked){
    const groupW = bw; // una barra per linea
    totalW = padL + padR + rows.length*groupW + Math.max(0,(rows.length-1))*gap;
  }else{
    const MET = 6; // tot + 5S
    const groupW = MET*bw + (MET-1)*inner;
    totalW = padL + padR + rows.length*groupW + Math.max(0,(rows.length-1))*gap;
  }

  canvas.style.width  = totalW + 'px';
  canvas.style.height = Hcss + 'px';
  canvas.width  = Math.round(totalW * DPR);
  canvas.height = Math.round(Hcss * DPR);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,totalW,Hcss);

  // griglia
  const plotW = totalW - padL - padR;
  ctx.strokeStyle = GRID; ctx.font='12px system-ui'; ctx.fillStyle=TXT;
  ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+plotH); ctx.lineTo(padL+plotW,padT+plotH); ctx.stroke();
  for(let i=0;i<=4;i++){
    const y=padT+plotH-(i*0.25)*plotH;
    ctx.fillText((i*25)+'%',8,y+4);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
  }

  const COLORS={'1S':C1,'2S':C2,'3S':C3,'4S':C4,'5S':C5, tot:'#9bb0d6'};
  let x=padL;

  if(chartPref.stacked){
    // una barra per linea, segmenti 1S..5S stacked
    rows.forEach(g=>{
      const stack=['1S','2S','3S','4S','5S'].map(k=>g.byS[k]||0);
      let yTop = padT+plotH;
      stack.forEach((v,i)=>{
        const h=v*plotH; const y=yTop-h;
        ctx.fillStyle = COLORS[['1S','2S','3S','4S','5S'][i]];
        ctx.fillRect(x,y,bw,h);
        yTop = y;
      });
      // etichetta e % totale
      ctx.fillStyle=TXT; ctx.textAlign='center';
      ctx.fillText(Math.round((g.tot||0)*100)+'%', x+bw/2, yTop-4);
      ctx.save(); ctx.translate(x+bw/2, padT+plotH+16); ctx.rotate(-Math.PI/12); ctx.fillText(g.line,0,0); ctx.restore();

      x += bw + gap;
    });
  }else{
    // clustered: tot + 1S..5S
    const MET = ["tot","1S","2S","3S","4S","5S"];
    const groupW = MET.length*bw + (MET.length-1)*inner;

    rows.forEach(g=>{
      let bx=x;
      MET.forEach(m=>{
        const v=(m==='tot'?g.tot:g.byS[m])||0, h=v*plotH, y=padT+plotH-h;
        ctx.fillStyle=COLORS[m]; ctx.fillRect(bx,y,bw,h);
        ctx.fillStyle=TXT; ctx.textAlign='center';
        if(h>18) ctx.fillText(Math.round(v*100)+'%', bx+bw/2, y-4);
        else     ctx.fillText(Math.round(v*100)+'%', bx+bw/2, padT+plotH-2);
        bx += bw + inner;
      });
      ctx.save(); ctx.translate(x+groupW/2, padT+plotH+16); ctx.rotate(-Math.PI/12); ctx.fillText(g.line,0,0); ctx.restore();
      x += groupW + gap;
    });
  }

  // ripristina scroll salvato
  if(typeof chartPref.scroll==='number'){
    scroller.scrollLeft = chartPref.scroll;
  }
  // salva scroll durante l'uso
  scroller.addEventListener('scroll',()=>{
    chartPref.scroll = scroller.scrollLeft;
    saveChartPref();
  }, {passive:true});
}

// Buttons linee
function buildLineButtons(list){
  const host=$('#areasList'); host.innerHTML='';
  const bAll=document.createElement('button'); bAll.className='line-btn'+(ui.line==='ALL'?' active':''); bAll.textContent='Tutte';
  bAll.addEventListener('click',()=>{ui.line='ALL'; elLineFilter.value='ALL'; render(); window.scrollTo({top:host.offsetTop,behavior:'smooth'});});
  host.appendChild(bAll);
  (list||filteredAreas()).forEach(a=>{
    const b=document.createElement('button'); b.className='line-btn'+(ui.line===(a.line||'')?' active':''); b.textContent=a.line||'—';
    b.addEventListener('click',()=>{ui.line=a.line||''; elLineFilter.value=ui.line; render();
      setTimeout(()=>{const card=[...document.querySelectorAll('.area')].find(x=>x.querySelector('.area-line')?.value.trim()===(a.line||'').trim()); card?.scrollIntoView({behavior:'smooth',block:'start'});},0);
    });
    host.appendChild(b);
  });
}

// Eventi resize/orientation
window.addEventListener('orientationchange', ()=> setTimeout(()=>drawChart(),250));
window.addEventListener('resize', ()=> drawChart());
window.addEventListener('load', ()=> requestAnimationFrame(()=> drawChart()));

// GO
render();


