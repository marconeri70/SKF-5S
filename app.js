const VERSION='v7.17.15';
const STORE='skf.5s.v7.17.15';
const CHART_STORE=STORE+'.chart';

window.addEventListener("DOMContentLoaded", () => {
  document.querySelector('#appVersionFooter')?.replaceChildren(VERSION);
});

/* Funzione per aggiornare i punteggi */
function updateScore(node, area, curSector, scoreEl, domEl){
  const {byS,total,dom}=computeByS(area,curSector);
  if(scoreEl) scoreEl.textContent=pct(total);
  if(domEl) domEl.textContent=`${dom.S} ${pct(dom.v)}`;

  // aggiorna pillole riepilogo
  if(node){
    node.querySelector('.score-1S').textContent=pct(byS['1S']);
    node.querySelector('.score-2S').textContent=pct(byS['2S']);
    node.querySelector('.score-3S').textContent=pct(byS['3S']);
    node.querySelector('.score-4S').textContent=pct(byS['4S']);
    node.querySelector('.score-5S').textContent=pct(byS['5S']);
  }
}

/* Click sulle pillole → scroll e flash */
function enablePillClicks(node){
  const pills=node.querySelectorAll('.score-pill');
  pills.forEach(p=>{
    p.addEventListener('click',()=>{
      const s=p.dataset.s;
      const target=node.querySelector(`.panel[data-s="${s}"]`);
      if(target){
        target.scrollIntoView({behavior:'smooth',block:'center'});
        target.classList.add('flash-panel');
        setTimeout(()=>target.classList.remove('flash-panel'),1200);
      }
    });
  });
}

/* Popup descrizione globale */
const infoDlg=document.getElementById('infoDlg');
document.addEventListener('click',(ev)=>{
  const btn=ev.target.closest('.info');
  if(!btn) return;
  const panel=btn.closest('.panel');
  const title=panel?.querySelector('h4')?.textContent?.trim()||'Dettagli';
  const descEl=panel?.querySelector('.s-desc')||panel?.querySelector('.desc');
  const body=descEl?descEl.textContent.trim():'';
  if(panel){
    const s=(panel.getAttribute('data-s')||'').slice(0,2).toLowerCase();
    infoDlg.className=''; if(s) infoDlg.classList.add(s);
  }
  infoDlg.querySelector('#infoTitle').textContent=title;
  infoDlg.querySelector('#infoBody').textContent=body;
  try{infoDlg.showModal();}catch(e){}
});