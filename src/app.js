import { initIndustrialSuite } from "./industrial-suite.js";
import QRCode from "qrcode";
import * as XLSX from "xlsx";

const STORE_PRODUCTS = "toolstock.products.v1";
const STORE_SETTINGS = "toolstock.settings.v1";
const STORE_EMPLOYEES = "toolstock.employees.v1";
const STORE_MOVEMENTS = "toolstock.movements.v1";
const defaultSettings = { appName:"ToolStock Pro", companyName:"", language:"es", currency:"EUR", tax:21, theme:"dark", negativeStock:false, hidePrices:false, confirmDelete:true };
let products = JSON.parse(localStorage.getItem(STORE_PRODUCTS) || "[]");
let settings = { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORE_SETTINGS) || "{}") };
let employees = JSON.parse(localStorage.getItem(STORE_EMPLOYEES) || "[]");
let movements = JSON.parse(localStorage.getItem(STORE_MOVEMENTS) || "[]");
let history = ["home"];
let pendingImport = [];

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const titles = {home:"Panel del taller",products:"Productos",productForm:"Nuevo producto",import:"Importar materiales",movements:"Movimientos",reports:"Informes",qr:"Etiquetas QR",settings:"Configuración",employees:"Empleados",assistant:"ToolStock IA",help:"Información y ayuda"};

function go(screen, push=true) {
  if (!titles[screen]) return;
  if (push && history.at(-1) !== screen) history.push(screen);
  $$(".screen").forEach(el => el.classList.toggle("active", el.dataset.screen === screen));
  $$(".bottom-nav button").forEach(el => el.classList.toggle("active", el.dataset.go === screen));
  $("#screenTitle").textContent = titles[screen];
  $("#backBtn").classList.toggle("hidden", screen === "home");
  if (screen === "home") renderMetrics();
  if (screen === "products") renderProducts();
  if (screen === "qr") renderQrChoices();
  if (screen === "movements") renderMovements();
  if (screen === "settings") renderEmployeeSummary();
  if (screen === "employees") renderEmployees();
  window.scrollTo({top:0,behavior:"instant"});
}
function back() {
  if (history.length > 1) history.pop();
  go(history.at(-1) || "home", false);
}
window.addEventListener("popstate", back);
$$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
$$("[data-back]").forEach(b => b.addEventListener("click", back));
$("#backBtn").addEventListener("click", back);

function toast(message) {
  const el=$("#toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2600);
}
function saveProducts() { localStorage.setItem(STORE_PRODUCTS, JSON.stringify(products)); renderMetrics(); }
function money(value) { return new Intl.NumberFormat(settings.language,{style:"currency",currency:settings.currency}).format(Number(value)||0); }
function renderMetrics() {
  $("#metricProducts").textContent=products.length;
  $("#metricLow").textContent=products.filter(p=>Number(p.stock)<=Number(p.minimumStock)).length;
  $("#metricValue").textContent=money(products.reduce((s,p)=>s+Number(p.stock||0)*Number(p.unitPrice||0),0));
}
function renderProducts(filter="") {
  const q=filter.toLowerCase().trim();
  const rows=products.filter(p=>[p.name,p.reference,p.equipment,p.location].join(" ").toLowerCase().includes(q));
  $("#productList").innerHTML=rows.length ? rows.map(p=>`<article class="list-item"><div><b>${esc(p.name)}</b><small>${esc(p.reference)} · ${esc(p.location||"Sin ubicación")} · ${Number(p.stock)} ${esc(p.unit||"unidades")}</small></div><span class="badge ${Number(p.stock)<=Number(p.minimumStock)?"low":""}">${Number(p.stock)<=Number(p.minimumStock)?"Stock bajo":"Disponible"}</span></article>`).join("") : `<div class="empty"><span>▤</span><h3>Sin productos</h3><p>Añade uno manualmente o importa un archivo Excel.</p></div>`;
}
const movementTypeNames={consumption:"Salida / consumo",output:"Préstamo o entrega",entry:"Entrada",return:"Devolución",adjustment:"Ajuste"};
function movementSign(type){return ["entry","return"].includes(type)?1:-1;}
function populateMovementProducts(){
  const select=$("#movementProduct");
  const selected=select.value;
  select.innerHTML=`<option value="">Seleccionar producto</option>${products.map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.reference)} · Stock: ${Number(p.stock)} ${esc(p.unit||"unidades")}</option>`).join("")}`;
  if(products.some(p=>p.id===selected))select.value=selected;
  updateMovementStockInfo();
}
function updateMovementStockInfo(){
  const product=products.find(p=>p.id===$("#movementProduct").value);
  const info=$("#movementStockInfo");
  if(!product){info.classList.add("hidden");return;}
  info.classList.remove("hidden");
  info.innerHTML=`<span>Stock disponible</span><b>${Number(product.stock)} ${esc(product.unit||"unidades")}</b><small>${esc(product.warehouse||"Sin almacén")} · ${esc(product.location||"Sin ubicación")}</small>`;
}
$("#movementProduct").addEventListener("change",updateMovementStockInfo);
$("#movementForm").addEventListener("submit",e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget));
  const product=products.find(p=>p.id===data.productId);
  const quantity=Number(data.quantity);
  if(!product)return toast("Selecciona un producto");
  if(!Number.isFinite(quantity)||quantity<=0)return toast("Indica una cantidad válida");
  const delta=movementSign(data.type)*quantity;
  const newStock=Number(product.stock||0)+delta;
  if(newStock<0&&!settings.negativeStock)return toast(`No hay stock suficiente. Disponible: ${Number(product.stock)} ${product.unit||"unidades"}`);
  product.stock=Number(newStock.toFixed(3));
  movements.unshift({
    ...data,id:crypto.randomUUID(),quantity,delta,
    productName:product.name,reference:product.reference,unit:product.unit||"unidades",
    stockBefore:Number((newStock-delta).toFixed(3)),stockAfter:product.stock,
    createdAt:new Date().toISOString()
  });
  localStorage.setItem(STORE_MOVEMENTS,JSON.stringify(movements));
  saveProducts();
  e.currentTarget.reset();
  renderMovements();
  toast(`Movimiento guardado · Stock actual: ${product.stock} ${product.unit||"unidades"}`);
});
function renderMovements(filter=""){
  populateMovementProducts();
  const q=filter.toLowerCase().trim();
  const rows=movements.filter(m=>[m.productName,m.reference,m.responsible,m.destination,m.equipment,m.destinationArea].join(" ").toLowerCase().includes(q));
  $("#movementCount").textContent=`${movements.length} ${movements.length===1?"registro":"registros"}`;
  $("#movementList").innerHTML=rows.length?rows.map(m=>{
    const incoming=m.delta>0;
    const when=new Intl.DateTimeFormat(settings.language,{dateStyle:"short",timeStyle:"short"}).format(new Date(m.createdAt));
    return `<article class="movement-card">
      <div class="movement-icon ${incoming?"in":"out"}">${incoming?"+":"−"}</div>
      <div class="movement-main"><div><b>${esc(m.productName)}</b><span class="movement-qty ${incoming?"in":"out"}">${incoming?"+":""}${Number(m.delta)} ${esc(m.unit)}</span></div>
      <small>${esc(movementTypeNames[m.type]||m.type)} · ${when}</small>
      <p><strong>Responsable:</strong> ${esc(m.responsible)}<br><strong>Destino:</strong> ${esc(m.destination)}${m.equipment?` · ${esc(m.equipment)}`:""}</p>
      <small>Stock: ${Number(m.stockBefore)} → ${Number(m.stockAfter)} ${esc(m.unit)}</small></div>
    </article>`;
  }).join(""):`<div class="empty compact"><span>⇄</span><h3>Sin movimientos</h3><p>Registra una entrada, salida, consumo o devolución.</p></div>`;
}
$("#searchMovements").addEventListener("input",e=>renderMovements(e.target.value));
$("#exportMovements").addEventListener("click",()=>{
  if(!movements.length)return toast("No hay movimientos para exportar");
  const rows=movements.map(m=>({
    "Fecha":new Date(m.createdAt).toLocaleString(settings.language),
    "Tipo":movementTypeNames[m.type]||m.type,
    "Referencia":m.reference,"Producto":m.productName,"Cantidad":m.quantity,
    "Variación de stock":m.delta,"Stock anterior":m.stockBefore,"Stock posterior":m.stockAfter,
    "Unidad":m.unit,"Responsable":m.responsible,"Destino / uso":m.destination,
    "Equipo / OT":m.equipment,"Zona destino":m.destinationArea,"Observaciones":m.notes
  }));
  exportBook(rows,"Movimientos_ToolStock.xlsx","Movimientos");toast("Historial Excel generado");
});
$("#searchProducts").addEventListener("input",e=>renderProducts(e.target.value));
$("#productForm").addEventListener("submit", e => {
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget));
  if(products.some(p=>p.reference.toLowerCase()===data.reference.toLowerCase())) return toast("Ya existe un producto con esa referencia");
  products.unshift({...data,id:crypto.randomUUID(),stock:Number(data.stock),minimumStock:Number(data.minimumStock),unitPrice:Number(data.unitPrice),createdAt:new Date().toISOString()});
  saveProducts(); e.currentTarget.reset(); toast("Producto guardado correctamente"); go("products");
});

const aliases={
  reference:["referencia","reference","ref","codigo","código"],
  name:["nombre","producto","material","name","descripcion","descripción"],
  category:["categoria","categoría","category"],
  stock:["stock","cantidad","existencias"],
  minimumStock:["stock minimo","stock mínimo","minimo","mínimo"],
  unit:["unidad","unit"],
  unitPrice:["precio","precio unitario","importe","unit price"],
  site:["centro","taller","site"],
  warehouse:["almacen","almacén","warehouse"],
  location:["ubicacion","ubicación","estanteria","estantería"],
  equipment:["equipo","maquina","máquina"],
  line:["linea","línea","area","área"],
  supplier:["proveedor","supplier"],
  barcode:["codigo de barras","código de barras","barcode"],
  serial:["numero de serie","número de serie","serial"],
  notes:["notas","observaciones","notes"]
};
function normalizeRow(row) {
  const normalized={}; Object.entries(row).forEach(([k,v])=>normalized[k.toLowerCase().trim()]=v);
  const p={}; Object.entries(aliases).forEach(([field,names])=>{const key=names.find(n=>normalized[n]!==undefined);p[field]=key?normalized[key]:"";});
  p.reference=String(p.reference||"").trim(); p.name=String(p.name||"").trim();
  p.stock=Number(p.stock)||0;p.minimumStock=Number(p.minimumStock)||0;p.unitPrice=Number(p.unitPrice)||0;p.unit=p.unit||"unidades";
  return p;
}
$("#importFile").addEventListener("change", async e => {
  const file=e.target.files[0]; if(!file)return;
  try{
    const book=XLSX.read(await file.arrayBuffer(),{type:"array"});
    const raw=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:""});
    pendingImport=raw.map(normalizeRow).filter(p=>p.name&&p.reference);
    $("#importCount").textContent=`${pendingImport.length} filas válidas`;
    $("#importRows").innerHTML=pendingImport.slice(0,100).map(p=>`<tr><td>${esc(p.reference)}</td><td>${esc(p.name)}</td><td>${p.stock}</td><td>${p.minimumStock}</td><td>${esc(p.location)}</td><td>${products.some(x=>x.reference.toLowerCase()===p.reference.toLowerCase())?"Actualizar":"Nuevo"}</td></tr>`).join("");
    $("#importPreview").classList.remove("hidden");
  }catch(err){toast("No se pudo leer el archivo");}
});
$("#confirmImport").addEventListener("click",()=>{
  let added=0,updated=0;
  pendingImport.forEach(p=>{const i=products.findIndex(x=>x.reference.toLowerCase()===p.reference.toLowerCase());if(i>=0){products[i]={...products[i],...p};updated++;}else{products.push({...p,id:crypto.randomUUID(),createdAt:new Date().toISOString()});added++;}});
  saveProducts();pendingImport=[];$("#importPreview").classList.add("hidden");toast(`${added} añadidos · ${updated} actualizados`);go("products");
});
$("#downloadTemplate").addEventListener("click",()=>{
  const row={"Referencia":"ROD-6204","Nombre":"Rodamiento 6204 2RS","Categoría":"Rodamientos","Stock":10,"Stock mínimo":3,"Unidad":"unidades","Precio unitario":8.5,"Centro":"Taller principal","Almacén":"Almacén A","Ubicación":"A-03-B","Equipo":"Motor principal","Línea":"Producción","Proveedor":"Proveedor ejemplo","Código de barras":"","Número de serie":"","Notas":""};
  exportBook([row],"Plantilla_productos_ToolStock.xlsx","Plantilla");
});
function reportRows(items){return items.map(p=>({"Referencia":p.reference,"Producto":p.name,"Categoría":p.category,"Stock actual":p.stock,"Stock mínimo":p.minimumStock,"Unidad":p.unit,"Precio unitario":p.unitPrice,"Valor total":Number(p.stock)*Number(p.unitPrice),"Centro/Taller":p.site,"Almacén":p.warehouse,"Ubicación":p.location,"Equipo/Máquina":p.equipment,"Línea/Área":p.line,"Proveedor":p.supplier,"Código de barras":p.barcode,"Número de serie":p.serial,"Notas":p.notes}));}
function exportBook(rows,file,sheet){
  const ws=XLSX.utils.json_to_sheet(rows);ws["!cols"]=Object.keys(rows[0]||{}).map(k=>({wch:Math.max(13,k.length+3)}));ws["!autofilter"]={ref:ws["!ref"]||"A1:A1"};
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,sheet);XLSX.writeFile(wb,file);
}
$("#exportInventory").addEventListener("click",()=>{if(!products.length)return toast("No hay productos para exportar");exportBook(reportRows(products),"Inventario_ToolStock.xlsx","Inventario");toast("Informe Excel generado");});
$("#exportLow").addEventListener("click",()=>{const low=products.filter(p=>Number(p.stock)<=Number(p.minimumStock));if(!low.length)return toast("No hay productos bajo mínimo");exportBook(reportRows(low),"Stock_bajo_ToolStock.xlsx","Reposición");});
function renderQrChoices(){$("#qrProductList").innerHTML=products.length?products.map(p=>`<label class="check-item"><input type="checkbox" value="${p.id}"><div><b>${esc(p.name)}</b><small>${esc(p.reference)} · ${esc(p.location||"Sin ubicación")}</small></div></label>`).join(""):`<div class="empty"><p>Añade productos para generar etiquetas.</p></div>`;}
$("#printQr").addEventListener("click",async()=>{
  const ids=$$("#qrProductList input:checked").map(i=>i.value);const selected=products.filter(p=>ids.includes(p.id));if(!selected.length)return toast("Selecciona al menos un producto");
  const labels=await Promise.all(selected.map(async p=>({p,img:await QRCode.toDataURL(JSON.stringify({type:"toolstock-product",id:p.id,reference:p.reference}),{width:320,margin:1})})));
  const w=open("","_blank");w.document.write(`<html><head><title>QR ToolStock</title><style>body{font-family:Arial;display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;padding:10mm}.l{border:1px solid #bbb;text-align:center;padding:4mm;break-inside:avoid}.l img{width:42mm}.l b,.l small{display:block;margin:2mm}@media print{button{display:none}}</style></head><body>${labels.map(({p,img})=>`<div class=l><img src="${img}"><b>${esc(p.name)}</b><small>${esc(p.reference)} · ${esc(p.location||"")}</small></div>`).join("")}<button onclick="print()">Imprimir</button></body></html>`);w.document.close();toast("Hoja QR generada. Al cerrar volverás aquí.");
});
function applySettings(){
  $("#appName").textContent=settings.appName;$$(".currencySymbol").forEach(x=>x.textContent=new Intl.NumberFormat(settings.language,{style:"currency",currency:settings.currency}).formatToParts(0).find(x=>x.type==="currency")?.value||settings.currency);
  document.body.classList.toggle("light",settings.theme==="light");const form=$("#settingsForm");Object.entries(settings).forEach(([k,v])=>{if(!form.elements[k])return;if(form.elements[k].type==="checkbox")form.elements[k].checked=Boolean(v);else form.elements[k].value=v;});renderMetrics();
}
$("#settingsForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);settings={...settings,...Object.fromEntries(f),negativeStock:f.has("negativeStock"),hidePrices:f.has("hidePrices"),confirmDelete:f.has("confirmDelete")};localStorage.setItem(STORE_SETTINGS,JSON.stringify(settings));applySettings();toast("Configuración guardada");back();});
$("#chooseDriveFolder").addEventListener("click",()=>{
  if(window.ToolStockAndroid?.chooseDriveFolder){window.ToolStockAndroid.chooseDriveFolder();}
  else toast("Esta opción se activa dentro de la aplicación Android");
});
window.onToolStockDriveFolderSelected=(name)=>{
  $("#driveFolderStatus").textContent=`Carpeta vinculada: ${name||"Google Drive"}`;
  toast("Carpeta privada vinculada correctamente");
};
const roleNames={manager:"Encargado",operator:"Operario",viewer:"Consulta"};
function saveEmployees(){
  localStorage.setItem(STORE_EMPLOYEES,JSON.stringify(employees));
  renderEmployees();
  renderEmployeeSummary();
}
function renderEmployeeSummary(){
  const el=$("#employeeSummary");
  if(!el)return;
  el.innerHTML=`<b>${employees.length} de 3 empleados añadidos</b><small>${employees.length ? employees.map(e=>esc(e.name)).join(" · ") : "Todavía no hay empleados invitados"}</small>`;
}
function renderEmployees(){
  $("#employeeCapacity").textContent=`${employees.length} de 3 empleados`;
  $("#capacityDots").innerHTML=[0,1,2].map(i=>`<i class="${i<employees.length?"used":""}"></i>`).join("");
  $("#employeeForm").classList.toggle("hidden",employees.length>=3);
  $("#employeeList").innerHTML=employees.length?employees.map(e=>`<article class="employee-card">
    <span class="avatar">${esc(e.name.trim().charAt(0).toUpperCase())}</span>
    <div><b>${esc(e.name)}</b><small>${esc(e.email)}</small><span class="role">${roleNames[e.role]||"Operario"}</span></div>
    <div class="employee-actions"><button class="mini-btn" type="button" data-invite="${e.id}">Invitar</button><button class="mini-btn danger" type="button" data-remove-employee="${e.id}">Eliminar</button></div>
  </article>`).join(""):`<div class="empty compact"><span>♙</span><h3>Sin empleados</h3><p>Puedes añadir hasta tres personas.</p></div>`;
  $$("[data-invite]").forEach(b=>b.addEventListener("click",()=>shareEmployeeInvite(b.dataset.invite)));
  $$("[data-remove-employee]").forEach(b=>b.addEventListener("click",()=>{
    const employee=employees.find(e=>e.id===b.dataset.removeEmployee);
    if(!employee||!confirm(`¿Retirar a ${employee.name} del equipo?`))return;
    employees=employees.filter(e=>e.id!==employee.id);saveEmployees();toast("Empleado retirado");
  }));
}
$("#employeeForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(employees.length>=3)return toast("Ya están ocupadas las 3 plazas");
  const data=Object.fromEntries(new FormData(e.currentTarget));
  const email=data.email.trim().toLowerCase();
  if(employees.some(x=>x.email.toLowerCase()===email))return toast("Ese correo ya está añadido");
  const employee={...data,email,id:crypto.randomUUID(),status:"pending",createdAt:new Date().toISOString()};
  employees.push(employee);saveEmployees();e.currentTarget.reset();toast("Empleado añadido");shareEmployeeInvite(employee.id);
});
async function shareEmployeeInvite(id){
  const employee=employees.find(e=>e.id===id);if(!employee)return;
  const company=settings.companyName||settings.appName||"ToolStock Pro";
  const text=`${company} te invita a colaborar en ToolStock Pro como ${roleNames[employee.role]||"Operario"}. Abre la aplicación y selecciona la carpeta de empresa que el propietario comparta contigo en Google Drive.`;
  try{
    if(navigator.share)await navigator.share({title:"Invitación a ToolStock Pro",text});
    else location.href=`mailto:${encodeURIComponent(employee.email)}?subject=${encodeURIComponent("Invitación a ToolStock Pro")}&body=${encodeURIComponent(text)}`;
  }catch(err){if(err?.name!=="AbortError")toast("No se pudo abrir la invitación");}
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
initIndustrialSuite({
  getProducts:()=>products,
  getMovements:()=>movements,
  getSettings:()=>settings,
  go,toast,esc
});
applySettings();renderEmployeeSummary();renderMetrics();go("home",false);
