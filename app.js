/* ===================== SKF 5S – app.js (v7.16.0) =========================
   - Etichette grafico più chiare (no overlap, CH più in basso)
   - Pillole 1S–5S sopra la linea: cliccabili → focus sulla sezione
   - Scheda con 5 sezioni fisse (descrizioni ufficiali)
   - Fix responsive pulsante "Elimina voce"
=========================================================================== */
const VERSION='v7.17.16';
const STORE='skf.5s.v7.17.16';
const CHART_STORE=STORE+'.chart';
const POINTS=[0,1,3,5];

/* Descrizioni ufficiali */
const DESCR = {
  "1S":"Eliminare ciò che non serve. Rimuovi tutto ciò che è inutile e crea un'area di lavoro essenziale, ordinata e sicura.",
  "2S":"Ogni cosa al suo posto. Organizza gli strumenti e i materiali in modo che siano facili da trovare, usare e riporre.",
  "3S":"Pulire è ispezionare. Mantieni pulito il posto di lavoro e, mentre lo pulisci, cerca e risolvi le cause dello sporco o dei problemi.",
  "4S":"Rendere l'ordine una routine. Stabilisci regole e standard visivi chiari (come etichette e colori) che tutti devono seguire.",
  "5S":"Non smettere mai di migliorare. Rendi le prime 4S un'abitudine quotidiana per tutti e promuovi il miglioramento continuo."
};

/* Voci di default (una per S come punto di partenza; espandibili) */
const DEFAULT_VOCI = {
  "1S":[{t:"Selezione del necessario",d:DESCR["1S"],p:0,resp:"",due:"",note:""}],
  "2S":[{t:"Organizzazione posto di lavoro",d:DESCR["2S"],p:0,resp:"",due:"",note:""}],
  "3S":[{t:"Pulizia e ispezione",d:DESCR["3S"],p:0,resp:"",due:"",note:""}],
  "4S":[{t:"Standard visivi e regole",d:DESCR["4S"],p:0,resp:"",due:"",note:""}],
  "5S":[{t:"Sostenere e migliorare",d:DESCR["5S"],p:0,resp:"",due:"",note:""}]
};

/* Utils */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const todayISO=()=>new Date().toISOString().slice(0,10);
const isOverdue=d=>d && new Date(d+'T23:59:59')<new Date();
const pct=n=>Math.round((n||0)*100)+'%';
const nextCH=()=>{
  const nums=(state.areas||[]).map(a=>((a.line||'').match(/^CH\s*(\d+)/i)||[])[1]).filter(Boolean).map(n=>+n).sort((a,b)=>a-b);
  const last=nums.length?nums[nums.length-1]:1; return `CH ${last+1}`;
};

/* State helpers */
function makeSectorSet(){return JSON.parse(JSON.stringify(DEFAULT_VOCI));}
function makeArea(line){return{line,sectors:{Rettifica:makeSectorSet(),Montaggio:makeSectorSet()}};}
function load(){try{const raw=localStorage.getItem(STORE);return raw?JSON.parse(raw):{areas:[makeArea('CH 2')]}}catch{return{areas:[makeArea('CH 2')]}}}
function save(){localStorage.setItem(STORE,JSON.stringify(state))}
function loadChartPref(){try{return JSON.parse(localStorage.getItem(CHART_STORE))||{zoom:1,stacked:false,scroll:0}}catch{return{zoom:1,stacked:false,scroll:0}}}
function saveChartPref(){localStorage.setItem(CHART_STORE,JSON.stringify(chartPref))}

/* State */
let state=load();
let ui={q:'',line:'ALL',sector:'ALL',onlyLate:false};
let chartPref=loadChartPref();
const highlightKeys=new Set();

/* DOM */
const elAreas=$('#areas'), elLineFilter=$('#lineFilter'), elQ=$('#q'), elOnlyLate=$('#onlyLate');
const tplArea=$('#tplArea'), tplItem=$('#tplItem');
const elKpiAreas=$('#kpiAreas'), elKpiScore=$('#kpiScore'), elKpiLate=$('#kpiLate');
const sectorSelect=$('#sectorFilter');

/* Tema */
const btnTheme=$('#btnTheme');
if(localStorage.getItem('theme')==='dark') document.documentElement.classList.add('dark');
btnTheme?.addEventListener('click',()=>{
  const root=document.documentElement;
  root.classList.toggle('dark');
  localStorage.setItem('theme',root.classList.contains('dark')?'dark':'light');
});

/* Toolbar */
$('#btnNewArea')?.addEventListener('click',()=>{
  const proposal=nextCH();
  const line=(prompt('Nuova linea? (es. CH 3)',proposal)||proposal).trim();
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

function setSegBtn(sel){['#btnAll','#btnFgr','#btnAsm'].forEach(s=>$(s)?.classList.remove('active')); $(sel)?.classList.add('active');}
$('#btnAll')?.addEventListener('click',()=>{ui.sector='ALL'; setSegBtn('#btnAll'); sectorSelect.value='ALL'; render();});
$('#btnFgr')?.addEventListener('click',()=>{ui.sector='Rettifica'; setSegBtn('#btnFgr'); sectorSelect.value='Rettifica'; render();});
$('#btnAsm')?.addEventListener('click',()=>{ui.sector='Montaggio'; setSegBtn('#btnAsm'); sectorSelect.value='Montaggio'; render();});
sectorSelect?.addEventListener('change',()=>{
  ui.sector=sectorSelect.value;
  if(ui.sector==='ALL') setSegBtn('#btnAll');
  if(ui.sector==='Rettifica') setSegBtn('#btnFgr');
  if(ui.sector==='Montaggio') setSegBtn('#btnAsm');
  render();
});

elQ?.addEventListener('input',()=>{ui.q=elQ.value; render();});
elOnlyLate?.addEventListener('change',()=>{ui.onlyLate=elOnlyLate.checked; render();});
$('#btnClearFilters')?.addEventListener('click',()=>{
  ui={q:'',line:'ALL',sector:'ALL',onlyLate:false};
  elQ.value=''; elOnlyLate.checked=false; elLineFilter.value='ALL'; setSegBtn('#btnAll'); sectorSelect.value='ALL'; render();
});
elLineFilter?.addEventListener('change',()=>{ui.line=elLineFilter.value; render();});

$('#zoomIn')?.addEventListener('click',()=>{chartPref.zoom=Math.min(2.5, +(chartPref.zoom+0.1).toFixed(2)); saveChartPref(); drawChart();});
$('#zoomOut')?.addEventListener('click',()=>{chartPref.zoom=Math.max(0.6, +(chartPref.zoom-0.1).toFixed(2)); saveChartPref(); drawChart();});
$('#toggleStacked')?.addEventListener('change',e=>{chartPref.stacked=e.target.checked; saveChartPref(); drawChart();});

$('#btnCollapseAll')?.addEventListener('click',()=>{$$('.area').forEach(a=>a.classList.add('collapsed'));});
$('#btnExpandAll')?.addEventListener('click',()=>{$$('.area').forEach(a=>a.classList.remove('collapsed'));});

/* Render */

// === Info popup (global, single) ===
const infoDlg=document.getElementById('infoDlg');
function openInfo(title,text){
  if(!infoDlg) return;
  infoDlg.querySelector('#infoTitle').textContent = title||'';
  infoDlg.querySelector('#infoBody').textContent  = text||'';
  try{ infoDlg.showModal(); }catch(e){}
}
function themeInfoBy(panel){
  if(!infoDlg) return;
  infoDlg.className=''; // reset
  const s=(panel?.getAttribute('data-s')||'').slice(0,2).toLowerCase();
  if(s) infoDlg.classList.add(s);
}
document.addEventListener('click',(ev)=>{
  const btn = ev.target.closest('.info');
  if(!btn) return;
  const panel = btn.closest('.panel');
  const title = panel?.querySelector('h4')?.textContent?.trim() || btn.getAttribute('aria-label') || 'Dettagli';
  const descEl = panel?.querySelector('.s-desc') || panel?.querySelector('.desc');
  const body = descEl?descEl.textContent.trim():'';
  themeInfoBy(panel);
  openInfo(title, body);
});
function render(){
  const hv=document.querySelector('#appVersion'); if(hv) hv.textContent=''; document.querySelector('#appVersionFooter')?.replaceChildren(VERSION);
  refreshLineFilter();

  sectorSelect.value=ui.sector;
  if(ui.sector==='ALL') setSegBtn('#btnAll');
  if(ui.sector==='Rettifica') setSegBtn('#btnFgr');
  if(ui.sector==='Montaggio') setSegBtn('#btnAsm');

  const list=filteredAreas();
  elAreas.innerHTML='';
  list.forEach(a=>elAreas.appendChild(renderArea(a)));
  updateDashboard(list);
  drawChart(list);
  buildLineButtons(list);
}
function refreshLineFilter(){
  const lines=Array.from(new Set(state.areas.map(a=>(a.line||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'it',{numeric:true}));
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
  const domKey=Object.keys(byS).reduce((a,b)=> byS[a]>=byS[b]?a:b, '1S');
  return {byS, total:max?sum/max:0, dom:{S:domKey, v:byS[domKey]||0}};
}

/* Render Area */
function renderArea(area){
  const node=tplArea.content.firstElementChild.cloneNode(true);
  const line=$('.area-line',node), scoreEl=$('.score-val',node), domEl=$('.doms',node);
  const secTabs=$$('.tab.sec',node);
  const scorePills=$$('.score-pill',node);

  let curSector=(ui.sector==='ALL'?'Rettifica':ui.sector);

  line.value=area.line||''; 
  line.addEventListener('input',()=>{area.line=line.value.trim(); save(); refreshLineFilter(); buildLineButtons(); drawChart();});

  // settore
  secTabs.forEach(b=>{
    if(b.dataset.sector===curSector) b.classList.add('active');
    b.addEventListener('click',()=>{secTabs.forEach(x=>x.classList.remove('active')); b.classList.add('active'); curSector=b.dataset.sector; refill(); updateScore();});
  });

  // pillole 1S..5S → focus sezione
  scorePills.forEach(p=>{
    p.addEventListener('click',()=>{
      scorePills.forEach(x=>x.classList.remove('active'));
      p.classList.add('active');
      const s=p.textContent.trim().slice(0,2);
      const target=$(`.panel[data-s="${s}"]`,node);
      target?.scrollIntoView({behavior:'smooth',block:'center'});
    });
  });

  // bottone comprimi scheda
  const btnCol=$('.collapse',node);
  const setCol=()=>{btnCol.textContent=node.classList.contains('collapsed')?'Espandi':'Comprimi';};
  btnCol.addEventListener('click',()=>{node.classList.toggle('collapsed'); setCol();});
  setCol();

  // elimina linea
  $('.delete-area',node).addEventListener('click',()=>{
    if(!confirm('Eliminare la linea?')) return;
    state.areas.splice(state.areas.indexOf(area),1); save(); render();
  });

  function refill(){
    $$('.panel',node).forEach(p=>{
      const S=p.dataset.s;
      p.querySelector('.s-desc').textContent = DESCR[S];
      const host=p.querySelector('.items'); host.innerHTML='';
      (area.sectors[curSector][S]||[]).forEach((it,i)=> host.appendChild(renderItem(area,curSector,S,i,it,updateScore)));
    });
    const {byS}=computeByS(area,curSector);
    $('.score-1S',node).textContent=pct(byS['1S']);
    $('.score-2S',node).textContent=pct(byS['2S']);
    $('.score-3S',node).textContent=pct(byS['3S']);
    $('.score-4S',node).textContent=pct(byS['4S']);
    $('.score-5S',node).textContent=pct(byS['5S']);
  }
  function updateScore(node, area, curSector, scoreEl, domEl){
  const {byS,total,dom}=computeByS(area,curSector);
  if(scoreEl) scoreEl.textContent=pct(total);
  if(domEl) domEl.textContent=`${dom.S} ${pct(dom.v)}`;
  if(node){
    node.querySelector('.score-1S').textContent=pct(byS['1S']);
    node.querySelector('.score-2S').textContent=pct(byS['2S']);
    node.querySelector('.score-3S').textContent=pct(byS['3S']);
    node.querySelector('.score-4S').textContent=pct(byS['4S']);
    node.querySelector('.score-5S').textContent=pct(byS['5S']);
  }
}computeByS(area,curSector);
    scoreEl.textContent=pct(total);
    domEl.textContent=`${dom.S} ${pct(dom.v)}`;
    save(); updateDashboard(); drawChart(); buildLineButtons();
  }

  // add item nei pannelli
  $$('.panel',node).forEach(p=>{
    p.querySelector('.add-item')?.addEventListener('click',()=>{
      const S=p.dataset.s;
      area.sectors[curSector][S].push({t:"",d:"",p:0,resp:"",due:"",note:""}); save(); refill(); updateScore();
    });
  });

  refill(); updateScore();
  return node;
}

/* Render Item */
function renderItem(area,sector,S,idx,it,onChange){
  const frag=document.createDocumentFragment();
  const node=tplItem.content.firstElementChild.cloneNode(true);
  const desc=tplItem.content.children[1].cloneNode(true);

  const txt=$('.txt',node), resp=$('.resp',node), due=$('.due',node), note=$('.note',node);
  const dots=$$('.points-dots .dot',node);

  txt.value=it.t||''; resp.value=it.resp||''; due.value=it.due||''; note.value=it.note||'';
  desc.innerHTML=`<b>${it.t||'(senza titolo)'}</b><br>${it.d||''}`;

  const syncDots=()=>{ dots.forEach(d=> d.classList.toggle('active', +d.dataset.val === (+it.p||0))); };
  syncDots(); node.classList.toggle('late',isOverdue(it.due));

  txt.addEventListener('input',()=>{it.t=txt.value; desc.innerHTML=`<b>${it.t||'(senza titolo)'}</b><br>${it.d||''}`; save();});
  resp.addEventListener('input',()=>{it.resp=resp.value; save();});
  note.addEventListener('input',()=>{it.note=note.value; save();});
  due.addEventListener('change',()=>{it.due=due.value; save(); node.classList.toggle('late',isOverdue(it.due)); onChange?.();});

  dots.forEach(d=> d.addEventListener('click',()=>{ it.p=+d.dataset.val; syncDots(); save(); onChange?.(); }));

  $('.info',node).addEventListener('click',()=>{/* handled globally */});
  $('.del',node).addEventListener('click',()=>{ const arr=area.sectors[sector][S]; arr.splice(idx,1); save(); render(); });

  node.addEventListener('click',e=>{ if(e.target.classList.contains('dot')) node.classList.remove('highlight'); });
  $('.info',node).addEventListener('click',()=> node.classList.remove('highlight'));

  frag.appendChild(node); frag.appendChild(desc); return frag;
}

/* KPI / Late */
function overallStats(list){
  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
  let sum=0,max=0,late=0;
  (list||filteredAreas()).forEach(a=>{
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach(it=>{
      sum+=(+it.p||0); max+=5; if(isOverdue(it.due)) late++;
    })));
  });
  return {score:max?sum/max:0,late};
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
  highlightKeys.clear();
  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
  const arr=[];
  (list||filteredAreas()).forEach(a=>{
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach((it,idx)=>{
      if(isOverdue(it.due)){
        arr.push({line:a.line||'—',sector:sec,S,idx,title:it.t||'(senza titolo)',due:it.due});
        highlightKeys.add(`${a.line||'—'}|${S}`);
      }
    })));
  });
  if(!arr.length){host.style.display='none';drawChart();return;}
  host.style.display='flex';
  arr.forEach(x=>{
    const b=document.createElement('button');
    b.className='late-chip';
    b.innerHTML=`<span class="meta">${x.line} · ${x.sector} · ${x.S}</span> — ${x.title} · scad. ${x.due}`;
    b.addEventListener('click',()=>{focusLate(x); drawChart();});
    host.appendChild(b);
  });
  drawChart();
}
function focusLate(x){
  const card=[...document.querySelectorAll('.area')].find(a=>a.querySelector('.area-line')?.value.trim()===(x.line||'').trim());
  if(!card) return;
  card.classList.remove('collapsed');
  const secBtn=[...card.querySelectorAll('.tab.sec')].find(b=>b.dataset.sector===x.sector); secBtn?.click();
  card.scrollIntoView({behavior:'smooth',block:'start'});
  const panel=card.querySelector(`.panel[data-s="${x.S}"]`);
  const item=panel?.querySelectorAll('.item')[x.idx];
  if(item){
    item.classList.add('highlight');
    item.classList.remove('flash'); void item.offsetWidth; item.classList.add('flash');
  }
  highlightKeys.add(`${x.line||'—'}|${x.S}`);
}

/* --------------- CHART (canvas custom) ---------------- */
function drawChart(list){
  const canvas=$('#chartAreas');
  const scroller=canvas?.closest('.chart-scroll');
  if(!canvas) return;

  $('#toggleStacked').checked=!!chartPref.stacked;

  const DPR=window.devicePixelRatio||1, Hcss=260;
  const areas=(list||filteredAreas());
  const css=getComputedStyle(document.documentElement);
  const GRID=css.getPropertyValue('--outline')||'#d0d7e1';
  const TXT=css.getPropertyValue('--text')||'#003366';
  const C1=css.getPropertyValue('--c1').trim(),
        C2=css.getPropertyValue('--c2').trim(),
        C3=css.getPropertyValue('--c3').trim(),
        C4=css.getPropertyValue('--c4').trim(),
        C5=css.getPropertyValue('--c5').trim();

  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
  const rows=areas.map(a=>{
    let perS={"1S":{s:0,m:0},"2S":{s:0,m:0},"3S":{s:0,m:0},"4S":{s:0,m:0},"5S":{s:0,m:0}}, t={s:0,m:0};
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach(it=>{
      perS[S].s+=(+it.p||0); perS[S].m+=5; t.s+=(+it.p||0); t.m+=5;
    })));
    const byS={}; Object.keys(perS).forEach(S=>byS[S]=perS[S].m?perS[S].s/perS[S].m:0);
    return {line:a.line||'—',byS,tot:t.m?t.s/t.m:0};
  }).sort((a,b)=>a.line.localeCompare(b.line,'it',{numeric:true}));

  const padL=56,padR=16,padT=12,padB=56;
  const bwBase=14,innerBase=4,gapBase=18;
  const z=chartPref.zoom||1;
  const bw=Math.max(8,bwBase*z),
        inner=Math.max(3,innerBase*z),
        gap=Math.max(12,gapBase*z);
  const plotH=Hcss-padT-padB;

  let totalW;
  if(chartPref.stacked){
    totalW=padL+padR+rows.length*bw+Math.max(0,(rows.length-1))*gap;
  }else{
    const MET=6; // tot + 1S..5S
    const groupW=MET*bw+(MET-1)*inner;
    totalW=padL+padR+rows.length*groupW+Math.max(0,(rows.length-1))*gap;
  }

  canvas.style.width=totalW+'px';
  canvas.style.height=Hcss+'px';
  canvas.width=Math.round(totalW*DPR);
  canvas.height=Math.round(Hcss*DPR);
  const ctx=canvas.getContext('2d');
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,totalW,Hcss);

  const plotW=totalW-padL-padR;
  ctx.strokeStyle=GRID; ctx.font='12px system-ui'; ctx.fillStyle=TXT;
  ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+plotH); ctx.lineTo(padL+plotW,padT+plotH); ctx.stroke();
  for(let i=0;i<=4;i++){
    const y=padT+plotH-(i*0.25)*plotH;
    ctx.fillText((i*25)+'%',8,y+4);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
  }

  const COLORS={'1S':C1,'2S':C2,'3S':C3,'4S':C4,'5S':C5,tot:'#9bb0d6'};
  let x=padL;

  const drawOutline=(xx,yy,ww,hh,key)=>{
    if(!highlightKeys.has(key)) return;
    ctx.save();
    ctx.lineWidth=3;
    ctx.strokeStyle='#ffb400';
    ctx.shadowColor='rgba(255,180,0,.5)';
    ctx.shadowBlur=8;
    ctx.strokeRect(xx-1,yy-1,ww+2,hh+2);
    ctx.restore();
  };
  const textOnBg=(hex)=>{
    const h=hex.replace('#',''); const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
    const yiq=(r*299+g*587+b*114)/1000; return yiq>=140?'#0b1324':'#fff';
  };

  if(chartPref.stacked){
    rows.forEach(g=>{
      const order=['1S','2S','3S','4S','5S'];
      let yTop=padT+plotH;
      order.forEach(k=>{
        const v=g.byS[k]||0; const h=v*plotH; const y=yTop-h;
        ctx.fillStyle=COLORS[k]; ctx.fillRect(x,y,bw,h);

        if(v>0){
          const label=Math.round(v*100)+'%';
          const inside=h>=20; const col= inside? textOnBg(COLORS[k]) : TXT;
          ctx.fillStyle=col; ctx.textAlign='center';
          const yText = inside ? Math.max(padT+12, y+12) : Math.max(padT+12, y-4);
          ctx.fillText(label, x+bw/2, yText);
        }

        drawOutline(x,y,bw,h,`${g.line}|${k}`);
        yTop=y;
      });
      ctx.save(); ctx.fillStyle=TXT; ctx.textAlign='center'; ctx.font='600 13px system-ui';
      ctx.translate(x+bw/2,padT+plotH+30); ctx.rotate(-Math.PI/12); ctx.fillText(g.line,0,0); ctx.restore();
      x+=bw+gap;
    });
  }else{
    const MET=["tot","1S","2S","3S","4S","5S"];
    const groupW=MET.length*bw+(MET.length-1)*inner;
    rows.forEach(g=>{
      let bx=x;
      MET.forEach(m=>{
        const v=(m==='tot'?g.tot:g.byS[m])||0, h=v*plotH, y=padT+plotH-h;
        ctx.fillStyle=COLORS[m]; ctx.fillRect(bx,y,bw,h);

        // percentuale sopra la colonna (evita 0% per non affollare)
        if(v>0){
          ctx.fillStyle=TXT; ctx.textAlign='center';
          const yPct = y-6;
          ctx.fillText(Math.round(v*100)+'%',bx+bw/2,Math.max(padT+12,yPct));
        }
        // sigla S/Tot dentro o sopra senza collisioni con offset distinto
        const inside = h>=22;
        const sTxt = m==='tot' ? 'Tot' : m;
        if(inside){
          ctx.fillStyle = textOnBg(COLORS[m]);
          ctx.fillText(sTxt, bx+bw/2, y+14);
        }else{
          ctx.fillStyle = TXT;
          const yS = v>0 ? y-20 : y-6;
          ctx.fillText(sTxt, bx+bw/2, Math.max(padT+12, yS));
        }

        drawOutline(bx,y,bw,h, m==='tot' ? `${g.line}|tot` : `${g.line}|${m}`);
        bx+=bw+inner;
      });
      ctx.save(); ctx.fillStyle=TXT; ctx.textAlign='center'; ctx.font='600 13px system-ui';
      ctx.translate(x+groupW/2,padT+plotH+30); ctx.rotate(-Math.PI/12); ctx.fillText(g.line,0,0); ctx.restore();
      x+=groupW+gap;
    });
  }

  if(scroller){
    if(typeof chartPref.scroll==='number') scroller.scrollLeft=chartPref.scroll;
    scroller.addEventListener('scroll',()=>{chartPref.scroll=scroller.scrollLeft; saveChartPref();},{passive:true});
  }
}

/* Line buttons */
function buildLineButtons(list){
  const host=$('#areasList'); host.innerHTML='';
  const bAll=document.createElement('button'); bAll.className='line-btn'+(ui.line==='ALL'?' active':''); bAll.textContent='Tutte';
  bAll.addEventListener('click',()=>{ui.line='ALL'; elLineFilter.value='ALL'; render(); window.scrollTo({top:host.offsetTop,behavior:'smooth'});});
  host.appendChild(bAll);
  (list||filteredAreas()).forEach(a=>{
    const b=document.createElement('button'); b.className='line-btn'+(ui.line===(a.line||'')?' active':''); b.textContent=a.line||'—';
    b.addEventListener('click',()=>{ui.line=a.line||''; elLineFilter.value=ui.line; render(); setTimeout(()=>{const card=[...document.querySelectorAll('.area')].find(x=>x.querySelector('.area-line')?.value.trim()===(a.line||'').trim()); card?.scrollIntoView({behavior:'smooth',block:'start'});},0);});
    host.appendChild(b);
  });
}

/* Events */
window.addEventListener('orientationchange',()=>setTimeout(()=>drawChart(),250));
window.addEventListener('resize',()=>drawChart());
window.addEventListener('load',()=>requestAnimationFrame(()=>drawChart()));

/* Service worker (best effort) */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

/* Go */
render();
