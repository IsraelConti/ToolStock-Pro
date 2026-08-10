(()=>{
/* Mobile safety layer for the professional table planner.
   The planner is enhancement-only: the normal tables screen must always remain responsive. */
let scheduled=false,lastProject='';
const projectId=()=>localStorage.getItem('moments.current')||'';
function isTablesVisible(){const s=document.querySelector('[data-screen="tables"]');return !!s&&s.classList.contains('active')}
function lighten(){
  const room=document.querySelector('#roomCanvas');
  if(!room)return;
  const tables=room.querySelectorAll('.table-object');
  const mobile=matchMedia('(max-width:720px)').matches;
  room.classList.toggle('mobile-lite',mobile&&tables.length>12);
  if(mobile&&tables.length>18){
    tables.forEach((table,i)=>{
      if(i>=18)table.querySelectorAll('.seat').forEach(x=>x.remove());
    });
  }
}
function safeEnhance(){
  scheduled=false;
  if(!isTablesVisible())return;
  const id=projectId();
  if(id!==lastProject){lastProject=id;}
  try{requestAnimationFrame(lighten)}catch(e){console.warn('Moments planner mobile optimisation',e)}
}
function queue(){if(scheduled)return;scheduled=true;setTimeout(safeEnhance,80)}
const obs=new MutationObserver(mutations=>{
  if(!isTablesVisible())return;
  if(mutations.some(m=>m.target?.id==='roomCanvas'||m.target?.closest?.('#roomCanvas')))return;
  queue();
});
obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
document.addEventListener('click',e=>{if(e.target.closest('[data-go="tables"],#backBtn,[data-back]'))queue()},{passive:true});
window.addEventListener('resize',queue,{passive:true});
queue();
})();