import * as XLSX from "xlsx";

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY="moments.planner.v1";
const SETTINGS="moments.settings.v1";
let projects=JSON.parse(localStorage.getItem(KEY)||"[]");
let settings=JSON.parse(localStorage.getItem(SETTINGS)||'{"appName":"Moments Planner","companyName":"","language":"es","currency":"EUR","tax":21,"alertDays":7,"urgentDays":2,"notifications":true}');
let currentId=localStorage.getItem("moments.current")||"";
let currentScreen="home", historyStack=[];
const titles={home:"Bodas y eventos",projectForm:"Nuevo proyecto",dashboard:"Panel del proyecto",guests:"Invitados",tasks:"Tareas y fechas",budget:"Presupuesto",vendors:"Proveedores",schedule:"Agenda del día",tables:"Mesas",reports:"Informes",settings:"Configuración"};
const blankCollections=()=>({guests:[],tasks:[],expenses:[],vendors:[],schedule:[],tables:[]});
const current=()=>projects.find(p=>p.id===currentId);
const uid=()=>crypto.randomUUID();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmt=n=>new Intl.NumberFormat(settings.language||"es",{style:"currency",currency:settings.currency||"EUR"}).format(Number(n||0));
const date=v=>v?new Intl.DateTimeFormat(settings.language||"es",{dateStyle:"medium"}).format(new Date(`${v}T12:00:00`)):"Sin fecha";
const save=()=>{localStorage.setItem(KEY,JSON.stringify(projects));renderAll();};
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200);}

function go(screen,push=true){
  if(!["home","projectForm","settings"].includes(screen)&&!current()){toast("Primero abre o crea un proyecto");screen="home";}
  if(push&&screen!==currentScreen)historyStack.push(currentScreen);
  currentScreen=screen;
  $$(".screen").forEach(x=>x.classList.toggle("active",x.dataset.screen===screen));
  $("#screenTitle").textContent=titles[screen]||"Moments Planner";
  $("#backBtn").classList.toggle("hidden",screen==="home");
  $$(".bottom-nav button").forEach(x=>x.classList.toggle("active",x.dataset.go===screen));
  renderAll();scrollTo(0,0);
}
function back(){go(historyStack.pop()||"home",false);}
window.addEventListener("popstate",()=>back());
$("#backBtn").addEventListener("click",back);
$$("[data-back]").forEach(b=>b.addEventListener("click",back));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
window.onAndroidBack=()=>{if(currentScreen==="home")return false;back();return true;};

$$("[data-new-project]").forEach(b=>b.addEventListener("click",()=>{
  const type=b.dataset.newProject;
  $("#projectForm").reset();$("#projectForm [name=type]").value=type;
  $("#projectFormTitle").textContent=type==="wedding"?"Nueva boda":"Nuevo evento";
  $("#projectEyebrow").textContent=type==="wedding"?"PLANIFICADOR DE BODAS":"ORGANIZADOR DE EVENTOS";
  $("#weddingCoupleField").classList.toggle("hidden",type!=="wedding");
  $("#eventTypeField").classList.toggle("hidden",type!=="event");
  go("projectForm");
}));
$("#projectForm").addEventListener("submit",e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));
  const project={...data,...blankCollections(),id:uid(),createdAt:new Date().toISOString()};
  projects.unshift(project);currentId=project.id;localStorage.setItem("moments.current",currentId);save();historyStack=["home"];go("dashboard",false);toast(project.type==="wedding"?"Boda creada":"Evento creado");
});

function renderProjects(){
  $("#projectList").innerHTML=projects.length?projects.map(p=>`<article class="project-card ${p.type}">
    <span class="project-icon"><svg><use href="#${p.type==="wedding"?"rings":"party"}"/></svg></span>
    <div><b>${esc(p.name)}</b><small>${p.type==="wedding"?"Boda":"Evento"} · ${date(p.date)} · ${esc(p.venue||"Lugar pendiente")}</small></div>
    <button class="btn" data-open="${p.id}">Abrir</button>
  </article>`).join(""):`<div class="empty"><h3>Aún no hay proyectos</h3><p>Crea tu primera boda o evento con los botones superiores.</p></div>`;
  $$("[data-open]").forEach(b=>b.addEventListener("click",()=>{currentId=b.dataset.open;localStorage.setItem("moments.current",currentId);go("dashboard");}));
}
function renderDashboard(){
  const p=current();if(!p)return;
  const spent=p.expenses.reduce((a,x)=>a+Number(x.amount||0),0);
  const confirmed=p.guests.filter(x=>x.status==="confirmed").length;
  $("#projectHero").innerHTML=`<p class="eyebrow">${p.type==="wedding"?"PLANIFICACIÓN DE BODA":"ORGANIZACIÓN DE EVENTO"}</p><h1>${esc(p.name)}</h1><p>${date(p.date)}${p.time?` · ${esc(p.time)}`:""} · ${esc(p.venue||"Lugar pendiente")}</p><div class="countdown">${daysUntil(p.date)}</div>`;
  $("#mGuests").textContent=`${confirmed}/${p.guests.length}`;
  $("#mTasks").textContent=p.tasks.filter(x=>!x.done).length;
  $("#mSpent").textContent=fmt(spent);
  const actions=[
    ["guests","guests","Invitados",p.type==="wedding"?"Confirmaciones, menús y mesas":"Asistentes y acreditación"],
    ["tasks","tasks","Tareas","Fechas, responsables y avisos"],
    ["budget","money","Presupuesto","Gastos, pagos y vencimientos"],
    ["vendors","vendors","Proveedores","Contactos y servicios"],
    ["schedule","calendar","Agenda del día","Cronograma minuto a minuto"],
    ...(p.type==="wedding"?[["tables","tables","Mesas y banquete","Distribución de invitados"]]:[]),
    ["reports","calendar","Informes","Excel y copia del plan"]
  ];
  $("#dashboardActions").innerHTML=actions.map(a=>`<button class="action" data-go="${a[0]}"><svg><use href="#${a[1]}"/></svg><b>${a[2]}</b><small>${a[3]}</small></button>`).join("");
  $$("#dashboardActions [data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
}
function daysUntil(v){if(!v)return"Fecha por definir";const d=Math.ceil((new Date(`${v}T12:00:00`)-new Date())/86400000);return d<0?`Celebrado hace ${Math.abs(d)} días`:d===0?"¡Es hoy!":`Faltan ${d} días`;}

function addCollection(form,key,extra={}){
  form.addEventListener("submit",e=>{e.preventDefault();const p=current();if(!p)return;const item={...Object.fromEntries(new FormData(form)),...extra,id:uid(),createdAt:new Date().toISOString()};p[key].push(item);save();form.reset();toast("Guardado correctamente");});
}
addCollection($("#guestForm"),"guests");
addCollection($("#taskForm"),"tasks",{done:false});
addCollection($("#expenseForm"),"expenses");
addCollection($("#vendorForm"),"vendors");
addCollection($("#scheduleForm"),"schedule");
addCollection($("#tableForm"),"tables");

function empty(text){return`<div class="empty compact"><p>${text}</p></div>`;}
function del(key,id){const p=current();p[key]=p[key].filter(x=>x.id!==id);save();toast("Registro eliminado");}
function bindDeletes(){$$("[data-delete]").forEach(b=>b.onclick=()=>{const [key,id]=b.dataset.delete.split(":");if(confirm("¿Eliminar este registro?"))del(key,id);});}
function renderGuests(){
  const p=current();if(!p)return;
  $("#guestList").innerHTML=p.guests.length?p.guests.map(g=>`<article class="row"><div><b>${esc(g.name)}</b><small>${esc(g.group||"Sin grupo")} · ${esc(g.menu||"Menú sin indicar")}</small></div><span class="badge ${g.status}">${g.status==="confirmed"?"Confirmado":g.status==="declined"?"No asistirá":"Pendiente"}</span><button class="mini danger" data-delete="guests:${g.id}">×</button></article>`).join(""):empty("Añade invitados y controla su confirmación.");
}
function renderTasks(){
  const p=current();if(!p)return;
  $("#taskList").innerHTML=p.tasks.length?[...p.tasks].sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map(t=>`<article class="row ${t.done?"done":""}"><button class="check" data-done="${t.id}">${t.done?"✓":""}</button><div><b>${esc(t.title)}</b><small>${date(t.dueDate)} · ${esc(t.responsible||"Sin responsable")} · ${esc(t.priority)}</small></div><button class="mini danger" data-delete="tasks:${t.id}">×</button></article>`).join(""):empty("Añade tareas, responsables y fechas límite.");
  $$("[data-done]").forEach(b=>b.onclick=()=>{const t=p.tasks.find(x=>x.id===b.dataset.done);t.done=!t.done;save();});
}
function renderBudget(){
  const p=current();if(!p)return;
  const total=p.expenses.reduce((a,x)=>a+Number(x.amount||0),0),paid=p.expenses.reduce((a,x)=>a+Number(x.paid||0),0),max=Number(p.budget||0);
  $("#budgetSummary").innerHTML=`<div><small>Presupuesto</small><b>${fmt(max)}</b></div><div><small>Contratado</small><b>${fmt(total)}</b></div><div><small>Pendiente pago</small><b>${fmt(total-paid)}</b></div><div><small>Disponible</small><b class="${max-total<0?"danger-text":""}">${fmt(max-total)}</b></div>`;
  $("#expenseList").innerHTML=p.expenses.length?p.expenses.map(x=>`<article class="row"><div><b>${esc(x.concept)}</b><small>Pagado ${fmt(x.paid)} · Vence ${date(x.dueDate)}</small></div><strong>${fmt(x.amount)}</strong><button class="mini danger" data-delete="expenses:${x.id}">×</button></article>`).join(""):empty("Registra presupuestos, señales y pagos.");
}
function renderVendors(){const p=current();if(!p)return;$("#vendorList").innerHTML=p.vendors.length?p.vendors.map(v=>`<article class="row"><div><b>${esc(v.name)}</b><small>${esc(v.service)} · ${esc(v.contact||"Sin contacto")} · ${esc(v.notes||"")}</small></div><button class="mini danger" data-delete="vendors:${v.id}">×</button></article>`).join(""):empty("Añade finca, catering, música, fotografía, decoración y demás servicios.");}
function renderSchedule(){const p=current();if(!p)return;$("#scheduleList").innerHTML=p.schedule.length?[...p.schedule].sort((a,b)=>a.time.localeCompare(b.time)).map(x=>`<article><time>${esc(x.time)}</time><div><b>${esc(x.title)}</b><small>${esc(x.place||"Lugar pendiente")} · ${esc(x.responsible||"Sin responsable")}</small></div><button class="mini danger" data-delete="schedule:${x.id}">×</button></article>`).join(""):empty("Construye el cronograma completo del gran día.");}
function renderTables(){const p=current();if(!p)return;$("#tableList").innerHTML=p.tables.length?p.tables.map(t=>`<article class="row"><div><b>${esc(t.name)}</b><small>Capacidad ${esc(t.capacity)} · ${esc(t.zone||"Zona sin indicar")}</small></div><button class="mini danger" data-delete="tables:${t.id}">×</button></article>`).join(""):empty("Crea las mesas y controla su capacidad.");}
function renderAll(){renderProjects();renderDashboard();renderGuests();renderTasks();renderBudget();renderVendors();renderSchedule();renderTables();bindDeletes();}

function rows(type){const p=current();if(type==="guests")return p.guests.map(x=>({Nombre:x.name,Estado:x.status,Grupo:x.group,Menú:x.menu}));if(type==="budget")return p.expenses.map(x=>({Concepto:x.concept,Importe:Number(x.amount||0),Pagado:Number(x.paid||0),Pendiente:Number(x.amount||0)-Number(x.paid||0),Vencimiento:x.dueDate}));return p.tasks.map(x=>({Tarea:x.title,Fecha:x.dueDate,Prioridad:x.priority,Responsable:x.responsible,Completada:x.done?"Sí":"No"}));}
function excel(type,name){const data=rows(type);if(!data.length)return toast("No hay datos para exportar");const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(data);ws["!cols"]=Object.keys(data[0]).map(k=>({wch:Math.max(16,k.length+4)}));ws["!autofilter"]={ref:ws["!ref"]};XLSX.utils.book_append_sheet(wb,ws,name);XLSX.writeFile(wb,`${current().name}_${name}.xlsx`);toast("Excel generado");}
$("#exportGuests").onclick=()=>excel("guests","Invitados");
$("#exportBudget").onclick=()=>excel("budget","Presupuesto");
$("#exportFull").onclick=()=>{const p=current(),wb=XLSX.utils.book_new();[["Resumen",[{Proyecto:p.name,Tipo:p.type,Fecha:p.date,Lugar:p.venue,Invitados:p.guestTarget,Presupuesto:p.budget}]],["Invitados",rows("guests")],["Tareas",rows("tasks")],["Presupuesto",rows("budget")],["Proveedores",p.vendors],["Agenda",p.schedule]].forEach(([n,data])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),n));XLSX.writeFile(wb,`${p.name}_Plan_completo.xlsx`);toast("Plan completo generado");};

function applySettings(){
  $("#appName").textContent=settings.appName||"Moments Planner";
  const symbol=new Intl.NumberFormat(settings.language||"es",{style:"currency",currency:settings.currency||"EUR"}).formatToParts(0).find(x=>x.type==="currency")?.value||"€";
  $$(".currency").forEach(x=>x.textContent=symbol);
  const f=$("#settingsForm");Object.entries(settings).forEach(([k,v])=>{if(!f.elements[k])return;f.elements[k].type==="checkbox"?f.elements[k].checked=!!v:f.elements[k].value=v;});
}
$("#settingsForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);settings={...settings,...Object.fromEntries(f),notifications:f.has("notifications")};localStorage.setItem(SETTINGS,JSON.stringify(settings));applySettings();toast("Configuración guardada");back();};
$("#backupData").onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),settings,projects},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Moments_Planner_Copia.json";a.click();URL.revokeObjectURL(a.href);};

applySettings();renderAll();go("home",false);
