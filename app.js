/* SKF 5S – app.js v7.10 *****************************************************/
const STORE = 'skf.5s.v7.10';
const POINTS = [0,1,3,5];

/* Voci (sintesi Excel) */
const VOC_1S=[{title:"Zona pedonale pavimento",desc:"Area pedonale libera da congestione/ostacoli e pericoli di inciampo"},
{title:"Zona di lavoro (pavimento, macchina)",desc:"Solo il necessario per l’ordine in corso"},
{title:"Materiali",desc:"Materiale non necessario rimosso/segregato"},
{title:"Informazioni",desc:"Documenti necessari e in buono stato"},
{title:"Processo di etichettatura",desc:"Gestione etichette rosse / scarti definita"},
{title:"Piano per sostenere il risultato",desc:"Lavagna 5S, foto prima/dopo, azioni, punteggi, SPL"}];
const VOC_2S=[{title:"1-S Stato",desc:"Team e area definiti, 1S mantenuta"},
{title:"Sicurezza",desc:"Dispositivi/attrezzature identificati e accessibili"},
{title:"Qualità",desc:"Postazioni qualità ordinate e chiare"},
{title:"Documenti",desc:"Documenti al punto d’uso e aggiornati"},
{title:"Concetti",desc:"Ergonomia, punto d’uso, zero sprechi/confusione"},
{title:"Posizioni prefissate",desc:"Sagome/posti fissi: facile capire cosa manca"},
{title:"Visual Management di base",desc:"Linee/etichette/colori minimi attivi"}];
const VOC_3S=[{title:"1-S Stato",desc:"1S mantenuta"},
{title:"2-S Stato",desc:"2S mantenuta"},
{title:"Pulizia",desc:"Aree e macchine pulite (anche punti difficili)"},
{title:"Misure preventive",desc:"Cause di sporco/perdite rimosse alla radice"},
{title:"Pulire è routine",desc:"Routine con responsabilità e frequenze"},
{title:"Standard di pulizia",desc:"Standard e checklist visibili e seguiti"}];
const VOC_4S=[{title:"Aree di passaggio",desc:"Nessun deposito/ostacolo; pavimento libero"},
{title:"Area di lavoro",desc:"Solo il necessario per l’ordine corrente"},
{title:"Materiali",desc:"Materiali corretti e identificati"},
{title:"Informazione",desc:"Info necessarie e in buono stato"},
{title:"Visual Management",desc:"Indicatori visivi efficaci in routine"},
{title:"Posizioni prefissate",desc:"Prelievo/rimessa facili e immediati"},
{title:"Standard lavoro & check",desc:"SPL/istruzioni/checklist visibili e usate"},
{title:"Etichette e colori",desc:"Etichette chiare, codici colore coerenti"},
{title:"Marcature tubi/valvole",desc:"Tubi/valvole/strumenti marcati (colori standard)"},
{title:"Segnaletica a terra",desc:"Linee/campiture presenti e mantenute"},
{title:"Punti di ispezione",desc:"Chiari i punti e cosa controllare"},
{title:"Single Point Lessons",desc:"SPL aggiornate e usate"},
{title:"Standard & documentazione",desc:"Documentazione aggiornata/disponibile"},
{title:"Kanban & scorte",desc:"Gestione consumabili visiva (min/max)"},
{title:"Misure preventive",desc:"Anomalie risolte alla radice"}];
const VOC_5S=[{title:"Ognuno & ogni giorno",desc:"Tutti formati e coinvolti sugli standard"},
{title:"Miglioramento continuo",desc:"Evidenza prima/dopo; standard aggiornati"}];

/* Utils */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const todayISO=()=>new Date().toISOString().slice(0,10);
const isOverdue=d=>d && new Date(d+'T23:59:59')<new Date();
const pct=n=>Math.round(n*100)+'%';

function makeS(list){const m=l=>l.map(o=>({t:o.title,d:o.desc,p:0,resp:"",due:"",note:""}));return {"1S":m(list[0]),"2S":m(list[1]),"3S":m(list[2]),"4S":m(list[3]),"5S":m(list[4])};}
function makeSectorSet(){return makeS([VOC_1S,VOC_2S,VOC_3S,VOC_4S,VOC_5S]);}
function makeArea(line){return{line,sectors:{Rettifica:makeSectorSet(),Montaggio:makeSectorSet()}};}
function load(){try{const raw=localStorage.getItem(STORE);return raw?JSON.parse(raw):{areas:[]}}catch{return{areas:[]}}}
function save(){localStorage.setItem(STORE,JSON.stringify(state));}

/* Stato */
let state=load(); if(!state.areas?.length){state.areas=[makeArea('L2')];save();}
let ui={q:'',line:'ALL',sector:'ALL',onlyLate:false};

/* DOM refs */
const elAreas=$('#areas'), elKpiAreas=$('#kpiAreas'), elKpiScore=$('#kpiScore'), elKpiLate=$('#kpiLate');
const elLineFilter=$('#lineFilter'), elQ=$('#q'), elOnlyLate=$('#onlyLate');
const btnAll=$('#btnAll'), btnFgr=$('#btnFgr'), btnAsm=$('#btnAsm');
const tplArea=$('#tplArea'), tplItem=$('#tplItem');

/* Safety: template presenti */
if(!tplArea||!tplItem){console.error('Manca #tplArea o #tplItem in index.html');}

/* Top bar */
const btnTheme=$('#btnTheme');
if(btnTheme){
  const root=document.documentElement;
  if(localStorage.getItem('theme')==='dark') root.classList.add('dark');
  btnTheme.addEventListener('click',()=>{root.classList.toggle('dark');localStorage.setItem('theme',root.classList.contains('dark')?'dark':'light');});
}
$('#btnNewArea')?.addEventListener('click',()=>{const line=(prompt('Linea nuova? (es. L3)','L3')||'Lx').trim();state.areas.push(makeArea(line));save();render();});
$('#btnExport')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`SKF_5S_${todayISO()}.json`});document.body.appendChild(a);a.click();a.remove();});
$('#fileImport')?.addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{state=JSON.parse(await f.text());save();render();}catch{alert('File non valido')}});
$('#btnPrint')?.addEventListener('click',()=>window.print());

/* Filtri */
elQ?.addEventListener('input',()=>{ui.q=elQ.value;render();});
elLineFilter?.addEventListener('change',()=>{ui.line=elLineFilter.value;render();});
btnAll?.addEventListener('click',()=>{ui.sector='ALL';setSegActive(btnAll);render();});
btnFgr?.addEventListener('click',()=>{ui.sector='Rettifica';setSegActive(btnFgr);render();});
btnAsm?.addEventListener('click',()=>{ui.sector='Montaggio';setSegActive(btnAsm);render();});
elOnlyLate?.addEventListener('change',()=>{ui.onlyLate=elOnlyLate.checked;render();});
$('#btnClearFilters')?.addEventListener('click',()=>{ui={q:'',line:'ALL',sector:'ALL',onlyLate:false};elQ&&(elQ.value='');elLineFilter&&(elLineFilter.value='ALL');elOnlyLate&&(elOnlyLate.checked=false);setSegActive(btnAll);render();});
function setSegActive(btn){[btnAll,btnFgr,btnAsm].forEach(b=>b&&b.classList.remove('active'));btn&&btn.classList.add('active');}

/* Calcoli */
function scoreList(list){if(!list?.length)return 0;const s=list.reduce((a,it)=>a+(+it.p||0),0);return s/(5*list.length);}
function computeByS(area,sector){
  const secs=sector==='ALL'?['Rettifica','Montaggio']:[sector];
  const res={},sum={sum:0,max:0};
  ['1S','2S','3S','4S','5S'].forEach(S=>{
    let arr=[];secs.forEach(sec=>arr=arr.concat(area.sectors[sec][S]||[]));
    res[S]=scoreList(arr); arr.forEach(it=>{sum.sum+=(+it.p||0);sum.max+=5;});
  });
  return {byS:res,areaScore:sum.max?sum.sum/sum.max:0};
}
function matchFilters(area){
  if(ui.line!=='ALL' && (area.line||'').trim()!==ui.line) return false;
  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
  const q=(ui.q||'').toLowerCase();
  let ok=false;
  secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(area.sectors[sec][S]||[]).forEach(it=>{
    if(ui.onlyLate && !isOverdue(it.due)) return;
    if(!ui.q){ok=true;return;}
    const bag=`${it.t||''} ${it.note||''} ${it.resp||''}`.toLowerCase();
    if(bag.includes(q)) ok=true;
  })));
  return ok;
}
function filteredAreas(){return state.areas.filter(matchFilters);}
function overallStats(list){
  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
  let sum=0,max=0,late=0;
  (list||filteredAreas()).forEach(a=>{
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach(it=>{sum+=(+it.p||0);max+=5;if(isOverdue(it.due))late++;})));
  });
  return {score:max?sum/max:0,late};
}

/* Render */
function render(){
  refreshLineFilter();
  const list=filteredAreas();
  elAreas.innerHTML=''; list.forEach(a=>elAreas.appendChild(renderArea(a)));
  updateDashboard(list); drawAreasChart(list); buildLineButtons();
}
function refreshLineFilter(){
  if(!elLineFilter) return;
  const lines=Array.from(new Set(state.areas.map(a=>(a.line||'').trim()).filter(Boolean))).sort();
  elLineFilter.innerHTML=`<option value="ALL">Linea: Tutte</option>`+lines.map(l=>`<option value="${l}">${l}</option>`).join('');
  if(!lines.includes(ui.line)) ui.line='ALL';
  elLineFilter.value=ui.line;
}

function renderArea(area){
  const node=tplArea.content.firstElementChild.cloneNode(true);
  const lineEl=$('.area-line',node), scoreEl=$('.score-val',node);
  const secTabs=$$('.tab.sec',node), sTabs=$$('.tab.s',node), panels=$$('.panel',node);

  let localSector=(ui.sector==='ALL'?'Rettifica':ui.sector), localS='1S';

  lineEl.value=area.line||''; lineEl.addEventListener('input',()=>{area.line=lineEl.value.trim();save();refreshLineFilter();buildLineButtons();});

  secTabs.forEach(b=>{
    if(b.dataset.sector===localSector) b.classList.add('active');
    b.addEventListener('click',()=>{secTabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');localSector=b.dataset.sector;refillPanels();updateScore();});
  });

  sTabs.forEach(tab=>{
    tab.addEventListener('click',()=>{sTabs.forEach(t=>t.classList.remove('active'));tab.classList.add('active');localS=tab.dataset.s;panels.forEach(p=>p.classList.toggle('active',p.dataset.s===localS));});
  });

  $('.add-item',node).addEventListener('click',()=>{area.sectors[localSector][localS].push({t:"",d:"",p:0,resp:"",due:"",note:""});save();refillPanels();updateScore();});

  const btnCollapse=$('.collapse',node);
  const updateCollapse=()=>btnCollapse.textContent=node.classList.contains('collapsed')?'Espandi':'Comprimi';
  btnCollapse.addEventListener('click',()=>{node.classList.toggle('collapsed');updateCollapse();}); updateCollapse();

  $('.delete-area',node).addEventListener('click',()=>{if(confirm('Eliminare la linea?')){state.areas.splice(state.areas.indexOf(area),1);save();render();}});

  function refillPanels(){
    panels.forEach(p=>{
      const S=p.dataset.s; p.innerHTML='';
      (area.sectors[localSector][S]||[]).forEach((it,i)=> p.appendChild(renderItem(area,localSector,S,i,it)));
      p.classList.toggle('active',S===localS);
    });
    const pills={"1S":$('.score-1S',node),"2S":$('.score-2S',node),"3S":$('.score-3S',node),"4S":$('.score-4S',node),"5S":$('.score-5S',node)};
    const {byS}=computeByS(area,localSector); Object.entries(byS).forEach(([k,v])=> pills[k].textContent=pct(v));
  }
  function updateScore(){scoreEl.textContent=pct(computeByS(area,localSector).areaScore);}

  refillPanels(); updateScore();
  return node;
}

function renderItem(area,sector,S,idx,it){
  const frag=document.createDocumentFragment();
  const node=tplItem.content.firstElementChild.cloneNode(true);
  const desc=tplItem.content.children[1].cloneNode(true);

  // metadati per focus
  node.dataset.line=(area.line||'').trim(); node.dataset.sector=sector; node.dataset.s=S; node.dataset.idx=String(idx);

  const txt=$('.txt',node), resp=$('.resp',node), due=$('.due',node),
        note=$('.note',node), info=$('.info',node), dots=$$('.points-dots .dot',node);

  txt.value=it.t||''; resp.value=it.resp||''; due.value=it.due||''; note.value=it.note||'';
  if(it.d) desc.innerHTML=`<h4>${it.t||''}</h4><p>${it.d}</p>`;
  const markDots=()=>dots.forEach(d=>d.classList.toggle('active',+d.dataset.val===(+it.p||0)));
  markDots(); node.classList.toggle('late',isOverdue(it.due));

  txt.addEventListener('input',()=>{it.t=txt.value;if(it.d){const h=desc.querySelector('h4');h&&(h.textContent=it.t);}save();});
  resp.addEventListener('input',()=>{it.resp=resp.value;save();});
  note.addEventListener('input',()=>{it.note=note.value;save();});
  due.addEventListener('change',()=>{it.due=due.value;save();node.classList.toggle('late',isOverdue(it.due));updateDashboard();});

  dots.forEach(d=>d.addEventListener('click',()=>{it.p=+d.dataset.val;markDots();save();updateDashboard();drawAreasChart();buildLineButtons();}));
  info.addEventListener('click',()=>desc.classList.toggle('show'));
  $('.del',node).addEventListener('click',()=>{const arr=area.sectors[sector][S];arr.splice(idx,1);save();render();});

  frag.appendChild(node); frag.appendChild(desc); return frag;
}

/* Dashboard + elenco late */
function updateDashboard(list){
  const {score,late}=overallStats(list);
  elKpiAreas&&(elKpiAreas.textContent=(list||filteredAreas()).length);
  elKpiScore&&(elKpiScore.textContent=pct(score));
  elKpiLate&&(elKpiLate.textContent=late);
  renderLateList(list);
}
function renderLateList(list){
  const host=$('#lateList'); if(!host) return;
  host.innerHTML='';
  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
  const arr=[];
  (list||filteredAreas()).forEach(a=>{
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach((it,idx)=>{if(isOverdue(it.due))arr.push({line:a.line||'—',sector:sec,S,idx,title:it.t||'(senza titolo)',due:it.due});})));
  });
  if(!arr.length){host.style.display='none';return;} host.style.display='flex';
  arr.sort((a,b)=>(a.line+a.sector+a.S).localeCompare(b.line+b.sector+b.S));
  arr.forEach(x=>{const b=document.createElement('button');b.className='late-chip';b.innerHTML=`<span class="meta">${x.line} · ${x.sector} · ${x.S}</span> — ${x.title} · scad. ${x.due}`;b.addEventListener('click',()=>focusLate(x));host.appendChild(b);});
}
function focusLate(x){
  const card=[...document.querySelectorAll('.area')].find(a=>{const i=a.querySelector('.area-line');return i && (i.value||'').trim()===(x.line||'').trim();});
  if(!card) return;
  card.classList.contains('collapsed')&&card.classList.remove('collapsed');
  const secBtn=[...card.querySelectorAll('.tab.sec')].find(b=>b.dataset.sector===x.sector); secBtn&&secBtn.click();
  const sBtn=[...card.querySelectorAll('.tab.s')].find(b=>b.dataset.s===x.S); sBtn&&sBtn.click();
  card.scrollIntoView({behavior:'smooth',block:'start'});
  const panel=[...card.querySelectorAll('.panel')].find(p=>p.dataset.s===x.S);
  const item=panel?[...panel.querySelectorAll('.item')][x.idx]:null;
  if(item){item.classList.remove('flash');void item.offsetWidth;item.classList.add('flash');}
}

/* Grafico a barre */
function drawAreasChart(list){
  const canvas=$('#chartAreas'); if(!canvas) return;
  const ctx=canvas.getContext('2d'); const DPR=devicePixelRatio||1, Hcss=260;
  canvas.width=canvas.clientWidth*DPR; canvas.height=Hcss*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,canvas.width,canvas.height);

  const css=getComputedStyle(document.documentElement), GRID=css.getPropertyValue('--chart-grid')||'#d0d7e1', TXT=css.getPropertyValue('--chart-text')||'#003366';
  const C={TOT:'#9bb0d6',"1S":css.getPropertyValue('--c1'),"2S":css.getPropertyValue('--c2'),"3S":css.getPropertyValue('--c3'),"4S":css.getPropertyValue('--c4'),"5S":css.getPropertyValue('--c5')};

  const areas=(list||filteredAreas()); if(!areas.length) return;
  const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];

  const rows=areas.map(a=>{
    let t={sum:0,max:0}, perS={"1S":{s:0,m:0},"2S":{s:0,m:0},"3S":{s:0,m:0},"4S":{s:0,m:0},"5S":{s:0,m:0}};
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach(it=>{perS[S].s+=(+it.p||0);perS[S].m+=5;t.sum+=(+it.p||0);t.max+=5;})));
    const byS={}; Object.keys(perS).forEach(S=>byS[S]=perS[S].m?perS[S].s/perS[S].m:0);
    return {line:a.line||'—', vals:{TOT:(t.max?t.sum/t.max:0), ...byS}};
  });

  const padL=56,padR=16,padT=12,padB=46,W=canvas.clientWidth,H=Hcss,plotW=W-padL-padR,plotH=H-padT-padB;
  ctx.strokeStyle=GRID; ctx.fillStyle=TXT; ctx.font='12px system-ui';
  ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+plotH); ctx.lineTo(padL+plotW,padT+plotH); ctx.stroke();
  for(let i=0;i<=4;i++){const y=padT+plotH-(i*0.25)*plotH; ctx.fillText((i*25)+'%',8,y+4); ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();}

  const MET=["TOT","1S","2S","3S","4S","5S"], bw=14, inner=4, groupW=MET.length*bw+(MET.length-1)*inner, gap=Math.max(18, groupW*.9);
  const total=rows.length*groupW+(rows.length-1)*gap, start=padL+Math.max(0,(plotW-total)/2);
  let x=start; rows.sort((a,b)=>(a.line||'').localeCompare(b.line||''));
  rows.forEach(g=>{
    let bx=x;
    MET.forEach(m=>{const v=g.vals[m]||0, h=v*plotH, y=padT+plotH-h; ctx.fillStyle=(C[m]||'#999').trim(); ctx.fillRect(bx,y,bw,h); ctx.fillStyle=TXT; ctx.textAlign='center'; ctx.fillText(Math.round(v*100)+'%',bx+bw/2,(h>16?y-4:padT+plotH-2)); bx+=bw+inner;});
    ctx.save(); ctx.translate(x+groupW/2,padT+plotH+20); ctx.rotate(-Math.PI/12); ctx.fillStyle=TXT; ctx.textAlign='center'; ctx.fillText(g.line,0,0); ctx.restore();
    x+=groupW+gap;
  });
}

/* Bottoni linea */
function buildLineButtons(){
  const host=$('#lineBtns'); if(!host)return; host.innerHTML='';
  const bAll=document.createElement('button'); bAll.className='line-btn'+(ui.line==='ALL'?' active':''); bAll.textContent='Tutte';
  bAll.addEventListener('click',()=>{ui.line='ALL';elLineFilter&&(elLineFilter.value='ALL');render();window.scrollTo({top:host.offsetTop,behavior:'smooth'});});
  host.appendChild(bAll);

  Array.from(new Set(state.areas.map(a=>(a.line||'').trim()).filter(Boolean))).sort().forEach(line=>{
    const a=state.areas.find(x=>(x.line||'').trim()===line);
    const secs=ui.sector==='ALL'?['Rettifica','Montaggio']:[ui.sector];
    let t={"1S":{s:0,m:0},"2S":{s:0,m:0},"3S":{s:0,m:0},"4S":{s:0,m:0},"5S":{s:0,m:0}};
    secs.forEach(sec=>['1S','2S','3S','4S','5S'].forEach(S=>(a.sectors[sec][S]||[]).forEach(it=>{t[S].s+=(+it.p||0);t[S].m+=5;})));
    const p=S=>t[S].m?Math.round(100*t[S].s/t[S].m):0;
    const b=document.createElement('button'); b.className='line-btn'+(ui.line===line?' active':''); b.textContent=line;
    b.title=`1S ${p('1S')}% • 2S ${p('2S')}% • 3S ${p('3S')}% • 4S ${p('4S')}% • 5S ${p('5S')}%`;
    b.addEventListener('click',()=>{ui.line=line;elLineFilter&&(elLineFilter.value=line);render();setTimeout(()=>{const card=[...$$('.area .area-line')].find(i=>i.value.trim()===line)?.closest('.area');card?.scrollIntoView({behavior:'smooth',block:'start'});},0);});
    host.appendChild(b);
  });
}

/* Resize/orientation fixes per mobile */
window.addEventListener('orientationchange', ()=> setTimeout(()=>drawAreasChart(), 250));
window.addEventListener('resize', ()=> drawAreasChart());
window.addEventListener('load', ()=> requestAnimationFrame(()=> drawAreasChart()));

/* Init */
render();


