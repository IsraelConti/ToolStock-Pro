// Moments Planner visual salon editor
export function createFloorPlannerState(project){
  project.floorPlan ||= {name:'Salón principal',items:[]};
  return project.floorPlan;
}
export const FLOOR_ITEMS={round:'Mesa redonda',rect:'Mesa rectangular',presidential:'Mesa presidencial',dance:'Pista de baile',stage:'Escenario / DJ',bar:'Barra',buffet:'Buffet',door:'Puerta / acceso',special:'Zona especial'};
export function addFloorItem(project,type){
  const plan=createFloorPlannerState(project);
  const tables=['round','rect','presidential'];
  const sizes={round:[18,18],rect:[26,14],presidential:[38,13],dance:[35,28],stage:[32,16],bar:[28,11],buffet:[28,11],door:[18,8],special:[25,18]};
  const [w,h]=sizes[type]||[20,15];
  const item={id:crypto.randomUUID(),type,label:FLOOR_ITEMS[type]||type,x:10,y:10,w,h,rotation:0,seats:tables.includes(type)?(type==='presidential'?10:8):0,guestIds:[]};
  plan.items.push(item);return item;
}
export function moveFloorItem(project,id,x,y){const i=createFloorPlannerState(project).items.find(v=>v.id===id);if(i){i.x=Math.max(0,Math.min(100-i.w,x));i.y=Math.max(0,Math.min(100-i.h,y));}return i;}
export function assignGuestToSeat(project,itemId,guestId){const i=createFloorPlannerState(project).items.find(v=>v.id===itemId);if(!i||!i.seats)return false;i.guestIds||=[];if(i.guestIds.includes(guestId))return true;if(i.guestIds.length>=i.seats)return false;i.guestIds.push(guestId);return true;}
