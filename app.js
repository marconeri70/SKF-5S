/* ===================== SKF 5S – app.js (v7.15.2) =========================
   Fix: rimosso doppio 'const scroller' in drawChart() che rompeva tutto.
   Restyling etichette S e CH rimane come nella 7.15.1.
=========================================================================== */
const VERSION='v7.15.2';
const STORE='skf.5s.v7.10.3';
const CHART_STORE=STORE+'.chart';
const POINTS=[0,1,3,5];

/* --- Voci di esempio --- */
const VOC_1S=[{t:"Zona pedonale pavimento",d:"Area pedonale libera da ostacoli e pericoli di inciampo"},
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
{t:"Marcature tubi/valvole",d:"Tubi/valvole marcati (colori standard)"},
{t:"Segnaletica a terra",d:"Linee/campiture presenti e mantenute"},
{t:"Punti di ispezione",d:"Chiari i punti e cosa controllare"},
{t:"Single Point Lessons",d:"SPL aggiornate e usate"},
{t:"Standard & documentazione",d:"Documentazione aggiornata/disponibile"},
{t:"Kanban & scorte",d:"Consumabili in visual management (min/max)"},
{t:"Misure preventive",d:"Anomalie risolte alla radice"}];
const VOC_5S=[{t:"Ognuno & ogni giorno",d:"Tutti formati e coinvolti sugli standard"},
{t:"Miglioramento continuo",d:"Evidenza prima/dopo; standard aggiornati"}];


/* --- Elementi UI --- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const elIntroCard=$('.intro-grid');
const elAreasSection=$('#areas');
const elGlobalScore=$('#globalScore');
const elChart=document.getElementById('chart');
const elChartSection=$('.chart-section');
const elChartWrapper=$('.chart-wrapper');
const elLineFilter=$('#lineFilter');
const tplArea=$('#tplArea');
const tplItem=$('#tplItem');

let ui = {
  line: 'ALL',
  mode: 'light'
};
let data = [];
let chartPref = {scroll:0};

const VOC={
  '1S':VOC_1S, '2S':VOC_2S, '3S':VOC_3S, '4S':VOC_4S, '5S':VOC_5S
};

/* ==================== Logica ==================== */

// Carica stato da localStorage
function loadState(){
  try{
    const d=localStorage.getItem(STORE);
    if(d) data=JSON.parse(d);
    const p=localStorage.getItem(CHART_STORE);
    if(p) chartPref=JSON.parse(p);
    render();
  }catch(e){console.error('Errore nel caricamento',e)}
}

// Salva stato in localStorage
function saveState(){
  try{
    localStorage.setItem(STORE,JSON.stringify(data));
  }catch(e){console.error('Errore nel salvataggio',e)}
}

function saveChartPref(){
  try{
    localStorage.setItem(CHART_STORE,JSON.stringify(chartPref));
  }catch(e){console.error('Errore nel salvataggio pref',e)}
}

// Calcola il punteggio di un'area
function getAreaScore(area){
  let totalScore=0, totalCount=0;
  for(const s in VOC){
    area.scores[s] = area.scores[s]||{};
    for(const i in VOC[s]){
      const item=area.scores[s][i]||{v:0};
      totalScore+=item.v;
      totalCount++;
    }
  }
  return totalCount>0?Math.round((totalScore/(totalCount*5))*100):0;
}

// Calcola il punteggio globale
function getGlobalScore(){
  let totalScore=0, totalCount=0;
  data.forEach(area=>{
    for(const s in VOC){
      area.scores[s] = area.scores[s]||{};
      for(const i in VOC[s]){
        const item=area.scores[s][i]||{v:0};
        totalScore+=item.v;
        totalCount++;
      }
    }
  });
  return totalCount>0?Math.round((totalScore/(totalCount*5))*100):0;
}

// Aggiunge nuova area
function addNewArea(line=''){
  const newArea={
    line,
    id:Date.now(),
    scores:{}
  };
  data.push(newArea);
  saveState();
  render();
  setTimeout(()=>{
    const areaEl=$(`#area-${newArea.id}`);
    if(areaEl) areaEl.scrollIntoView({behavior:'smooth',block:'center'});
  },50);
}

// Rimuove un'area
function deleteArea(areaId){
  if(!confirm('Sei sicuro di voler eliminare questa area?')) return;
  data=data.filter(a=>a.id!==areaId);
  saveState();
  render();
}

// Filtra le aree
function filteredAreas(){
  return ui.line==='ALL'?data:data.filter(a=>a.line===ui.line);
}

// Renderizza l'UI
function render(){
  const areas=filteredAreas();
  elAreasSection.innerHTML='';
  areas.forEach(area=>{
    const areaEl=tplArea.content.cloneNode(true);
    const areaCard=areaEl.querySelector('.area');
    areaCard.id=`area-${area.id}`;
    
    // Header
    const lineInput=areaCard.querySelector('.area-line');
    lineInput.value=area.line;
    lineInput.addEventListener('input',()=>{
      area.line=lineInput.value.trim();
      saveState();
      // rebuild select
      const lines=data.map(a=>a.line).filter(l=>l!=='');
      elLineFilter.innerHTML='<option value="ALL">Tutte</option>';
      lines.forEach(l=>{
        const opt=document.createElement('option');
        opt.value=l; opt.textContent=l;
        elLineFilter.appendChild(opt);
      });
      elLineFilter.value=ui.line;
      drawChart();
    });

    areaCard.querySelector('.delete').addEventListener('click',()=>{
      deleteArea(area.id);
    });
    areaCard.querySelector('.print').addEventListener('click',()=>{
      window.print();
    });

    // Punti
    const tabs=areaCard.querySelectorAll('.tab');
    tabs.forEach(tab=>{
      const s=tab.dataset.s;
      const panel=areaCard.querySelector(`.panel[data-s="${s}"]`);
      
      const sScore=area.scores[s]||{};
      const sScoreCount=Object.values(sScore).filter(i=>i.v>0).length;
      const sTotalCount=VOC[s].length;
      const sScoreValue=Object.values(sScore).reduce((a,b)=>a+(b.v||0),0);
      const sScorePercent=sTotalCount>0?Math.round((sScoreValue/(sTotalCount*5))*100):0;
      tab.querySelector('.badge-s').textContent=`${sScorePercent}%`;

      VOC[s].forEach((item,i)=>{
        const itemEl=tplItem.content.cloneNode(true);
        const itemCard=itemEl.querySelector('.item');
        const itemData=area.scores[s][i]||{};
        itemData.v=itemData.v||0;
        
        itemCard.querySelector('.txt').value=item.t;
        itemCard.querySelector('.resp').value=itemData.resp||'';
        itemCard.querySelector('.due').value=itemData.due||'';
        itemCard.querySelector('.note').value=itemData.note||'';

        const dots=itemCard.querySelectorAll('.dot');
        dots.forEach(dot=>{
          if(dot.dataset.val==itemData.v) dot.classList.add('active');
          dot.addEventListener('click',()=>{
            dots.forEach(d=>d.classList.remove('active'));
            dot.classList.add('active');
            itemData.v=parseInt(dot.dataset.val,10);
            area.scores[s][i]=itemData;
            saveState();
            render();
          });
        });

        const infoBtn=itemCard.querySelector('.info');
        infoBtn.addEventListener('click',()=>{
          const descEl=document.createElement('div');
          descEl.className='desc-show';
          descEl.textContent=item.d;
          itemCard.appendChild(descEl);
          itemCard.classList.add('expanded');
        });
        
        itemCard.querySelector('.close').addEventListener('click',()=>{
          itemCard.classList.remove('expanded');
          itemCard.querySelector('.desc-show').remove();
        });

        itemCard.querySelector('.resp').addEventListener('input',e=>{itemData.resp=e.target.value; area.scores[s][i]=itemData; saveState();});
        itemCard.querySelector('.due').addEventListener('input',e=>{itemData.due=e.target.value; area.scores[s][i]=itemData; saveState();});
        itemCard.querySelector('.note').addEventListener('input',e=>{itemData.note=e.target.value; area.scores[s][i]=itemData; saveState();});

        panel.appendChild(itemEl);
      });
      
      tab.addEventListener('click',()=>{
        tabs.forEach(t=>t.classList.remove('active'));
        areaCard.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
        tab.classList.add('active');
        panel.classList.add('active');
      });
    });

    elAreasSection.appendChild(areaEl);
  });
  
  elGlobalScore.textContent=`${getGlobalScore()}%`;
  drawChart();
}

// Disegna il grafico
function drawChart(){
  if(!elChart || !data.length) {elChartSection.style.display='none'; return;}
  elChartSection.style.display='block';
  const ctx=elChart.getContext('2d');
  const groups=data.map(a=>({line:a.line, score:getAreaScore(a)}));
  
  const totalW=groups.length*100;
  elChart.width=Math.max(elChartWrapper.clientWidth,totalW);
  elChart.height=250;
  
  const maxScore=100;
  const padding=15;
  const groupW=90;
  const gap=10;
  
  ctx.clearRect(0,0,elChart.width,elChart.height);
  ctx.font='12px Arial';
  ctx.textAlign='center';
  
  ctx.beginPath();
  ctx.moveTo(padding,elChart.height-padding);
  ctx.lineTo(elChart.width-padding,elChart.height-padding);
  ctx.strokeStyle='#ccc';
  ctx.stroke();
  
  for(let i=0;i<=10;i+=2){
    const y=elChart.height-padding-(i/10*maxScore/100*(elChart.height-padding*2));
    ctx.fillStyle='#ccc';
    ctx.fillText(i*10+'%',padding/2,y+5);
    ctx.beginPath();
    ctx.moveTo(padding,y);
    ctx.lineTo(elChart.width-padding,y);
    ctx.strokeStyle='rgba(0,0,0,0.1)';
    ctx.stroke();
  }
  
  let x=padding+groupW/2;
  groups.forEach(g=>{
    const h=g.score/100*(elChart.height-padding*2);
    ctx.fillStyle='#0095d9';
    ctx.fillRect(x-groupW/2,elChart.height-padding-h,groupW,h);
    ctx.fillStyle='white';
    ctx.fillText(g.score+'%',x,elChart.height-padding-h-10);
    ctx.fillStyle='#5c6f82';
    ctx.save();
    ctx.translate(x,elChart.height-padding+20);
    ctx.rotate(-Math.PI/12); ctx.fillText(g.line,0,0); ctx.restore();
    x+=groupW+gap;
  });

  const scroller = elChartWrapper;
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

// Event Listeners
document.addEventListener('DOMContentLoaded',()=>{
  loadState();

  $('#btnNewArea').addEventListener('click',()=>addNewArea());
  $('#btnExport').addEventListener('click',()=>{
    const json=JSON.stringify(data,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='skf-5s-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  
  $('#fileImport').addEventListener('change',e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        data=JSON.parse(e.target.result);
        saveState();
        render();
        alert('Dati importati con successo!');
      }catch(err){
        alert('Errore nell\'importazione del file JSON.');
      }
    };
    reader.readAsText(file);
  });
  
  $('#btnPrint').addEventListener('click',()=>window.print());
  $('#btnTheme').addEventListener('click',()=>{
    document.documentElement.classList.toggle('dark');
    const isDark=document.documentElement.classList.contains('dark');
    $('#btnTheme').textContent=isDark?'☀️ Tema':'🌙 Tema';
  });

  elLineFilter.addEventListener('change',()=>{
    ui.line=elLineFilter.value;
    render();
  });
});

window.addEventListener('resize',()=>drawChart());
