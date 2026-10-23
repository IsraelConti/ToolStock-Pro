import "./compat.js";
import { storage, storageProblems, demoMode } from "./storage.js";
import { initIndustrialSuite } from "./industrial-suite.js";
import { initLupa } from "./lupa.js";
import { createDriveSync } from "./drive-sync.js";
import QRCode from "qrcode";
import * as XLSX from "xlsx";

const STORE_PRODUCTS = "toolstock.products.v1";
const STORE_SETTINGS = "toolstock.settings.v1";
const STORE_EMPLOYEES = "toolstock.employees.v1";
const STORE_MOVEMENTS = "toolstock.movements.v1";
const defaultSettings = { appName:"ToolStock Pro: Repuestos", companyName:"", language:"es", currency:"EUR", tax:21, theme:"dark", negativeStock:false, hidePrices:false, confirmDelete:true };
const validProducts = value => Array.isArray(value) && value.every(p => p && typeof p.id === "string" && typeof p.reference === "string" && typeof p.name === "string" && Number.isFinite(Number(p.stock)));
if(demoMode && !storageProblems.length && storage.getItem(STORE_PRODUCTS)===null)storage.setItem(STORE_PRODUCTS,JSON.stringify([
  {id:"demo-bearing",reference:"DEMO-6204",name:"Rodamiento de demostración",stock:10,minimumStock:3,unitPrice:8.5,unit:"unidades",category:"Rodamientos",manufacturer:"Ejemplo",oemReference:"6204",criticality:"high",leadTimeDays:7,location:"A-01",warehouse:"Almacén demo",barcode:"1234567890128",createdAt:new Date().toISOString()},
  {id:"demo-seal",reference:"DEMO-JUNTA",name:"Junta de demostración",stock:0,minimumStock:2,unitPrice:4,unit:"unidades",criticality:"critical",leadTimeDays:30,location:"A-02",createdAt:new Date().toISOString()}
]));
let products = storage.readJSON(STORE_PRODUCTS, [], validProducts);
let settings = { ...defaultSettings, ...storage.readJSON(STORE_SETTINGS, {}, v=>v && typeof v === "object" && !Array.isArray(v)) };
let employees = storage.readJSON(STORE_EMPLOYEES, [], v=>Array.isArray(v) && v.every(e=>e && typeof e.id === "string" && typeof e.name === "string" && typeof e.email === "string"));
let movements = storage.readJSON(STORE_MOVEMENTS, [], v=>Array.isArray(v) && v.every(m=>m && typeof m.id === "string" && Number.isFinite(Number(m.delta)) && Number.isFinite(Date.parse(m.createdAt))));
let editingProductId = null;
let history = ["home"];
let pendingImport = [];

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const titles = {home:"Panel del taller",products:"Productos",productForm:"Nuevo producto",import:"Importar materiales",movements:"Movimientos",reports:"Informes",qr:"Etiquetas QR",settings:"Configuración",employees:"Empleados",assistant:"ToolStock IA",help:"Información y ayuda"};

function go(screen, push=true) {
  if (!titles[screen]) return;
  if (push && history[history.length-1] !== screen) history.push(screen);
  $$(".screen").forEach(el => el.classList.toggle("active", el.dataset.screen === screen));
  $$(".bottom-nav button").forEach(el => el.classList.toggle("active", el.dataset.go === screen));
  $("#screenTitle").textContent = titles[screen];
  $("#backBtn").classList.toggle("hidden", screen === "home");
  if (screen === "productForm" && !editingProductId) { $("#productForm").reset(); $("#productForm").elements.stock.readOnly=false; $("[data-screen=productForm] h2").textContent="Nuevo producto"; }
  if (screen !== "productForm") editingProductId = null;
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
  go(history[history.length-1] || "home", false);
}
window.addEventListener("popstate", back);
$$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
$$("[data-back]").forEach(b => b.addEventListener("click", back));
$("#backBtn").addEventListener("click", back);

function toast(message) {
  const el=$("#toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2600);
}
function saveProducts() {
  try { storage.writeBatch({ [STORE_PRODUCTS]:JSON.stringify(products), [STORE_MOVEMENTS]:JSON.stringify(movements) }); }
  catch(error) { products=storage.readJSON(STORE_PRODUCTS,[],validProducts); movements=storage.readJSON(STORE_MOVEMENTS,[],Array.isArray); toast(error.message); renderMetrics(); return false; }
  renderMetrics(); return true;
}
function money(value) { return new Intl.NumberFormat(settings.language,{style:"currency",currency:settings.currency}).format(Number(value)||0); }
function renderMetrics() {
  $("#metricProducts").textContent=products.length;
  $("#metricLow").textContent=products.filter(p=>Number(p.stock)<=Number(p.minimumStock)).length;
  $("#metricValue").textContent=money(products.reduce((s,p)=>s+Number(p.stock||0)*Number(p.unitPrice||0),0));
}
function renderProducts(filter="") {
  const q=filter.toLowerCase().trim();
  const rows=products.filter(p=>[p.name,p.reference,p.barcode,p.category,p.warehouse,p.equipment,p.location].join(" ").toLowerCase().includes(q));
  $("#productList").innerHTML=rows.length ? rows.map(p=>`<article class="list-item"><div><b>${esc(p.name)}</b><small>${esc(p.reference)} · ${esc(p.location||"Sin ubicación")} · ${Number(p.stock)} ${esc(p.unit||"unidades")}</small></div><span class="badge ${Number(p.stock)<=Number(p.minimumStock)?"low":""}">${Number(p.stock)<=Number(p.minimumStock)?"Stock bajo":"Disponible"}</span><div class="product-actions"><button class="mini-btn" type="button" data-edit-product="${esc(p.id)}">Editar</button><button class="mini-btn danger" type="button" data-delete-product="${esc(p.id)}">Eliminar</button></div></article>`).join("") : `<div class="empty"><span>▤</span><h3>Sin productos</h3><p>Añade uno manualmente o importa un archivo Excel.</p></div>`;
}
$("#productList").addEventListener("click",event=>{
  const edit=event.target.closest("[data-edit-product]");
  const remove=event.target.closest("[data-delete-product]");
  const product=products.find(p=>p.id===(edit?.dataset.editProduct||remove?.dataset.deleteProduct));
  if(!product)return;
  if(edit){
    editingProductId=product.id; go("productForm");
    const form=$("#productForm");form.reset();Object.entries(product).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value??"";});
    form.elements.stock.readOnly=true; $("[data-screen=productForm] h2").textContent="Editar producto · cambia el stock en Movimientos";return;
  }
  if(!confirm(`¿Eliminar ${product.name}? Se conserva el historial de movimientos.`))return;
  products=products.filter(p=>p.id!==product.id);if(saveProducts()){renderProducts($("#searchProducts").value);toast("Producto eliminado; historial conservado");}
});
const movementTypeNames={consumption:"Salida / consumo",output:"Préstamo o entrega",entry:"Entrada",return:"Devolución",adjustment:"Ajuste"};
function movementSign(type){return ["entry","return"].includes(type)?1:-1;}
function populateMovementProducts(){
  const select=$("#movementProduct");
  const selected=select.value;
  select.innerHTML=`<option value="">Seleccionar producto</option>${products.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.reference)} · Stock: ${Number(p.stock)} ${esc(p.unit||"unidades")}</option>`).join("")}`;
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
$("#movementForm").elements.type.addEventListener("change", e => {
  const quantity=$("#movementForm").elements.quantity;
  quantity.min=e.target.value==="adjustment"?"0":"0.001";
  quantity.placeholder=e.target.value==="adjustment"?"Stock total contado":"Ej.: 2";
});
$("#movementForm").addEventListener("submit",e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget));
  const product=products.find(p=>p.id===data.productId);
  const quantity=Number(data.quantity);
  if(!product)return toast("Selecciona un producto");
  if(!Number.isFinite(quantity)||(data.type==="adjustment"?quantity<0:quantity<=0))return toast("Indica una cantidad válida");
  const delta=data.type==="adjustment"?quantity-Number(product.stock||0):movementSign(data.type)*quantity;
  const newStock=Number(product.stock||0)+delta;
  if(newStock<0&&!settings.negativeStock)return toast(`No hay stock suficiente. Disponible: ${Number(product.stock)} ${product.unit||"unidades"}`);
  product.stock=Number(newStock.toFixed(3));
  movements.unshift({
    ...data,id:crypto.randomUUID(),quantity,delta,
    productName:product.name,reference:product.reference,unit:product.unit||"unidades",
    stockBefore:Number((newStock-delta).toFixed(3)),stockAfter:product.stock,
    createdAt:new Date().toISOString()
  });
  if(!saveProducts()) return;
  e.currentTarget.reset();
  e.currentTarget.elements.quantity.min="0.001";
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
    const when=new Intl.DateTimeFormat(settings.language,{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(m.createdAt));
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
  exportBook(rows,"Movimientos_ToolStock.xlsx","Movimientos");if (!window.ToolStockAndroid) toast("Historial Excel generado");
});
$("#searchProducts").addEventListener("input",e=>renderProducts(e.target.value));
$("#productForm").addEventListener("submit", e => {
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget));
  data.reference=data.reference.trim();data.name=data.name.trim();
  if(!data.name||!data.reference)return toast("Nombre y referencia son obligatorios");
  if(products.some(p=>p.id!==editingProductId&&p.reference.toLowerCase()===data.reference.toLowerCase())) return toast("Ya existe un producto con esa referencia");
  for(const key of ["stock","minimumStock","unitPrice","leadTimeDays"]){data[key]=Number(data[key]||0);if(!Number.isFinite(data[key])||data[key]<0)return toast("Revisa las cantidades y los importes");}
  if(editingProductId){const i=products.findIndex(p=>p.id===editingProductId);if(i<0)return toast("El producto ya no existe");products[i]={...products[i],...data,stock:products[i].stock,updatedAt:new Date().toISOString()};}
  else products.unshift({...data,id:crypto.randomUUID(),createdAt:new Date().toISOString()});
  if(!saveProducts())return;editingProductId=null;e.currentTarget.reset();toast("Producto guardado correctamente");go("products");
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
  notes:["notas","observaciones","notes"],
  manufacturer:["fabricante","manufacturer"],
  oemReference:["referencia oem","oem","oemreference"],
  criticality:["criticidad","criticality"],
  leadTimeDays:["plazo de entrega","plazo de entrega (días)","leadtimedays"],
  compatibility:["compatibilidad","equipo alternativo / compatibilidad","compatibility"],
  lastReview:["última revisión","ultima revision","lastreview"]
};
function normalizeRow(row) {
  const normalized={}; Object.entries(row).forEach(([k,v])=>normalized[k.toLowerCase().trim()]=v);
  const p={}; p._fields=[]; Object.entries(aliases).forEach(([field,names])=>{const key=names.find(n=>normalized[n]!==undefined);p[field]=key?normalized[key]:"";if(key)p._fields.push(field);});
  p.reference=String(p.reference||"").trim(); p.name=String(p.name||"").trim();
  for(const field of ["stock","minimumStock","unitPrice","leadTimeDays"]){
    const text=String(p[field]??"").trim();p[field]=text===""?0:Number(text.replace(",","."));
    if(!Number.isFinite(p[field])||p[field]<0)throw new Error(`Cantidad no válida en ${p.reference||"una fila"}: ${field}`);
  }
  p.unit=String(p.unit||"unidades");
  p.criticality=({"crítica":"critical","critica":"critical","alta":"high","media":"medium","baja":"low"})[String(p.criticality).toLowerCase()]||p.criticality||"medium";
  if(!["critical","high","medium","low"].includes(p.criticality))throw new Error("Criticidad no válida");
  return p;
}
$("#importFile").addEventListener("change", async e => {
  pendingImport=[];$("#importPreview").classList.add("hidden");
  const file=e.target.files[0]; if(!file)return;
  if(file.size>20*1024*1024)return toast("El archivo supera el límite de 20 MB");
  try{
    const book=/\.csv$/i.test(file.name)?XLSX.read(await file.text(),{type:"string"}):XLSX.read(await file.arrayBuffer(),{type:"array"});
    const raw=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:""});
    pendingImport=raw.map(normalizeRow).filter(p=>p.name&&p.reference);
    $("#importCount").textContent=`${pendingImport.length} filas válidas`;
    $("#importRows").innerHTML=pendingImport.slice(0,100).map(p=>`<tr><td>${esc(p.reference)}</td><td>${esc(p.name)}</td><td>${p.stock}</td><td>${p.minimumStock}</td><td>${esc(p.location)}</td><td>${products.some(x=>x.reference.toLowerCase()===p.reference.toLowerCase())?"Actualizar":"Nuevo"}</td></tr>`).join("");
    $("#importPreview").classList.remove("hidden");
  }catch(err){pendingImport=[];toast(err.message||"No se pudo leer el archivo");}
});
$("#confirmImport").addEventListener("click",()=>{
  if(!pendingImport.length)return toast("Selecciona un archivo con filas válidas");
  let added=0,updated=0;
  pendingImport.forEach(p=>{const i=products.findIndex(x=>x.reference.toLowerCase()===p.reference.toLowerCase());if(i>=0){products[i]={...products[i],...Object.fromEntries(p._fields.map(field=>[field,p[field]]))};updated++;}else{const {_fields,...data}=p;products.push({...data,id:crypto.randomUUID(),createdAt:new Date().toISOString()});added++;}});
  if(!saveProducts())return;pendingImport=[];$("#importPreview").classList.add("hidden");toast(`${added} añadidos · ${updated} actualizados`);go("products");
});
$("#downloadTemplate").addEventListener("click",()=>{
  const row={"Fabricante":"SKF","Referencia OEM":"6204-2RS","Criticidad":"high","Plazo de entrega (días)":7,"Compatibilidad":"Motor ejemplo","Última revisión":"2026-01-01","Referencia":"ROD-6204","Nombre":"Rodamiento 6204 2RS","Categoría":"Rodamientos","Stock":10,"Stock mínimo":3,"Unidad":"unidades","Precio unitario":8.5,"Centro":"Taller principal","Almacén":"Almacén A","Ubicación":"A-03-B","Equipo":"Motor principal","Línea":"Producción","Proveedor":"Proveedor ejemplo","Código de barras":"","Número de serie":"","Notas":""};
  exportBook([row],"Plantilla_productos_ToolStock.xlsx","Plantilla");
});
function reportRows(items){const rows=items.map(p=>({"Referencia":p.reference,"Producto":p.name,"Categoría":p.category,"Stock actual":p.stock,"Stock mínimo":p.minimumStock,"Unidad":p.unit,"Precio unitario":p.unitPrice,"Valor total":Number(p.stock)*Number(p.unitPrice),"Impuesto (%)":Number(settings.tax)||0,"Valor con impuestos":Number(p.stock)*Number(p.unitPrice)*(1+(Number(settings.tax)||0)/100),"Centro/Taller":p.site,"Almacén":p.warehouse,"Ubicación":p.location,"Equipo/Máquina":p.equipment,"Línea/Área":p.line,"Proveedor":p.supplier,"Código de barras":p.barcode,"Número de serie":p.serial,"Notas":p.notes,"Fabricante":p.manufacturer,"Referencia OEM":p.oemReference,"Criticidad":p.criticality,"Plazo de entrega (días)":p.leadTimeDays,"Compatibilidad":p.compatibility,"Última revisión":p.lastReview}));
  if(settings.hidePrices)rows.forEach(row=>{delete row["Precio unitario"];delete row["Valor total"];delete row["Valor con impuestos"];delete row["Impuesto (%)"];});return rows;
}
window.onToolStockFileSaved = (success, name) => toast(success ? `Archivo guardado: ${name}` : "No se guardó el archivo. Operación cancelada o error de almacenamiento.");
function exportBook(rows,file,sheet){
  const ws=XLSX.utils.json_to_sheet(rows);ws["!cols"]=Object.keys(rows[0]||{}).map(k=>({wch:Math.max(13,k.length+3)}));ws["!autofilter"]={ref:ws["!ref"]||"A1:A1"};
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,sheet);if (window.ToolStockAndroid?.saveBase64File) {
    window.ToolStockAndroid.saveBase64File(file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", XLSX.write(wb, { bookType: "xlsx", type: "base64" }));
  } else XLSX.writeFile(wb,file);
}
$("#exportInventory").addEventListener("click",()=>{if(!products.length)return toast("No hay productos para exportar");exportBook(reportRows(products),"Inventario_ToolStock.xlsx","Inventario");if (!window.ToolStockAndroid) toast("Informe Excel generado");});
$("#exportLow").addEventListener("click",()=>{const low=products.filter(p=>Number(p.stock)<=Number(p.minimumStock));if(!low.length)return toast("No hay productos bajo mínimo");exportBook(reportRows(low),"Stock_bajo_ToolStock.xlsx","Reposición");});
function renderQrChoices(){$("#qrProductList").innerHTML=products.length?products.map(p=>`<label class="check-item"><input type="checkbox" value="${esc(p.id)}"><div><b>${esc(p.name)}</b><small>${esc(p.reference)} · ${esc(p.location||"Sin ubicación")}</small></div></label>`).join(""):`<div class="empty"><p>Añade productos para generar etiquetas.</p></div>`;}
$("#printQr").addEventListener("click",async()=>{
  const ids=$$("#qrProductList input:checked").map(i=>i.value);const selected=products.filter(p=>ids.includes(p.id));if(!selected.length)return toast("Selecciona al menos un producto");
  const labels=await Promise.all(selected.map(async p=>({p,img:await QRCode.toDataURL(JSON.stringify({type:"toolstock-product",id:p.id,reference:p.reference}),{width:320,margin:1})})));
  const printWindow = window.ToolStockAndroid?.printHtml ? null : open("","_blank");
  if (!window.ToolStockAndroid?.printHtml && !printWindow) return toast("Permite las ventanas emergentes para imprimir etiquetas.");
  const html = `<html><head><title>QR ToolStock</title><style>body{font-family:Arial;display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;padding:10mm}.l{border:1px solid #bbb;text-align:center;padding:4mm;break-inside:avoid}.l img{width:42mm}.l b,.l small{display:block;margin:2mm}@media print{button{display:none}}</style></head><body>${labels.map(({p,img})=>`<div class=l><img src="${img}"><b>${esc(p.name)}</b><small>${esc(p.reference)} · ${esc(p.location||"")}</small></div>`).join("")}<button onclick="print()">Imprimir</button></body></html>`;if (window.ToolStockAndroid?.printHtml) window.ToolStockAndroid.printHtml(html);
  else { printWindow.document.write(html); printWindow.document.close(); }
  toast("Hoja QR generada. Al cerrar volverás aquí.");
});
function applySettings(){
  if(!["es","en","pt","fr","de","it"].includes(settings.language))settings.language="es";
  if(!["EUR","USD","GBP","MXN","BRL"].includes(settings.currency))settings.currency="EUR";
  document.body.classList.toggle("hide-prices",Boolean(settings.hidePrices));
  $("#appName").textContent=settings.appName;$$(".currencySymbol").forEach(x=>x.textContent=new Intl.NumberFormat(settings.language,{style:"currency",currency:settings.currency}).formatToParts(0).find(x=>x.type==="currency")?.value||settings.currency);
  document.body.classList.toggle("light",(settings.theme==="light"||(settings.theme==="system"&&window.matchMedia?.("(prefers-color-scheme: light)").matches)));const form=$("#settingsForm");Object.entries(settings).forEach(([k,v])=>{if(!form.elements[k])return;if(form.elements[k].type==="checkbox")form.elements[k].checked=Boolean(v);else form.elements[k].value=v;});renderMetrics();
}
$("#settingsForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);settings={...settings,...Object.fromEntries(f),negativeStock:f.has("negativeStock"),hidePrices:f.has("hidePrices"),confirmDelete:f.has("confirmDelete"),updatedAt:new Date().toISOString()};try{storage.setItem(STORE_SETTINGS,JSON.stringify(settings));}catch(error){settings={...defaultSettings,...storage.readJSON(STORE_SETTINGS,{},v=>v&&typeof v==="object")};toast(error.message);return;}applySettings();toast("Configuración guardada");back();});
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
  try{storage.setItem(STORE_EMPLOYEES,JSON.stringify(employees));}catch(error){employees=storage.readJSON(STORE_EMPLOYEES,[],Array.isArray);toast(error.message);return false;}
  renderEmployees();
  renderEmployeeSummary();return true;
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
    <div class="employee-actions"><button class="mini-btn" type="button" data-invite="${esc(e.id)}">Invitar</button><button class="mini-btn danger" type="button" data-remove-employee="${esc(e.id)}">Eliminar</button></div>
  </article>`).join(""):`<div class="empty compact"><span>♙</span><h3>Sin empleados</h3><p>Puedes añadir hasta tres personas.</p></div>`;
  $$("[data-invite]").forEach(b=>b.addEventListener("click",()=>shareEmployeeInvite(b.dataset.invite)));
  $$("[data-remove-employee]").forEach(b=>b.addEventListener("click",()=>{
    const employee=employees.find(e=>e.id===b.dataset.removeEmployee);
    if(!employee||!confirm(`¿Retirar a ${employee.name} del equipo?`))return;
    employees=employees.filter(e=>e.id!==employee.id);if(!saveEmployees())return;toast("Empleado retirado");
  }));
}
$("#employeeForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(employees.length>=3)return toast("Ya están ocupadas las 3 plazas");
  const data=Object.fromEntries(new FormData(e.currentTarget));
  const email=data.email.trim().toLowerCase();
  if(employees.some(x=>x.email.toLowerCase()===email))return toast("Ese correo ya está añadido");
  const employee={...data,email,id:crypto.randomUUID(),status:"pending",createdAt:new Date().toISOString()};
  employees.push(employee);if(!saveEmployees())return;e.currentTarget.reset();toast("Empleado añadido");shareEmployeeInvite(employee.id);
});
async function shareEmployeeInvite(id){
  const employee=employees.find(e=>e.id===id);if(!employee)return;
  const company=settings.companyName||settings.appName||"ToolStock Pro";
  const text=`${company} te propone colaborar como ${roleNames[employee.role]||"Operario"}. ToolStock Pro guarda datos en cada dispositivo. Para transferir el inventario, el propietario debe compartir una copia JSON que puedas restaurar. Este mensaje no concede acceso a cuentas ni permisos.`;
  try{
    if(navigator.share)await navigator.share({title:"Invitación a ToolStock Pro",text});
    else location.href=`mailto:${encodeURIComponent(employee.email)}?subject=${encodeURIComponent("Invitación a ToolStock Pro")}&body=${encodeURIComponent(text)}`;
  }catch(err){if(err?.name!=="AbortError")toast("No se pudo abrir la invitación");}
}
const backupKeys=[STORE_PRODUCTS,STORE_SETTINGS,STORE_EMPLOYEES,STORE_MOVEMENTS,"toolstock.owner.v1"];
function saveDownload(name,mime,bytes){
  if(window.ToolStockAndroid?.saveBase64File){
    let binary="";for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    window.ToolStockAndroid.saveBase64File(name,mime,btoa(binary));
  }else{
    const url=URL.createObjectURL(new Blob([bytes],{type:mime}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
function backupValues(){return Object.fromEntries([...backupKeys,"toolstock.transaction.v1"].map(key=>[key,storage.getItem(key)]));}
$("#exportBackup").addEventListener("click",()=>{
  const value={type:"toolstock-backup",version:1,mode:demoMode?"demo":"live",createdAt:new Date().toISOString(),raw:backupValues()};
  saveDownload(`ToolStock_copia_${new Date().toISOString().slice(0,10)}.json`,"application/json",new TextEncoder().encode(JSON.stringify(value,null,2)));
});
$("#restoreBackup").addEventListener("change",async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>20*1024*1024)throw new Error("La copia supera el límite de 20 MB");
    const backup=JSON.parse(await file.text());
    if(backup.type!=="toolstock-backup"||backup.version!==1||!backup.raw||backup.mode!==(demoMode?"demo":"live"))throw new Error("La copia no es válida para este inventario. Las copias demo y reales se restauran por separado.");
    const next={};for(const key of backupKeys){const raw=backup.raw[key];if(raw!==null&&typeof raw!=="string")throw new Error("Datos incompletos en la copia");next[key]=raw;}
    const ps=JSON.parse(next[STORE_PRODUCTS]||"[]"), ms=JSON.parse(next[STORE_MOVEMENTS]||"[]"), es=JSON.parse(next[STORE_EMPLOYEES]||"[]"), ss=JSON.parse(next[STORE_SETTINGS]||"{}");
    if(!validProducts(ps)||!Array.isArray(ms)||ms.some(m=>!m||typeof m.id!=="string"||!Number.isFinite(Number(m.delta))||!Number.isFinite(Date.parse(m.createdAt)))||!Array.isArray(es)||es.length>3||es.some(e=>!e||typeof e.name!=="string"||typeof e.email!=="string"||typeof e.id!=="string")||!ss||typeof ss!=="object"||Array.isArray(ss))throw new Error("La copia contiene registros dañados");
    if(new Set(ps.map(p=>p.reference.trim().toLowerCase())).size!==ps.length||new Set(ps.map(p=>p.id)).size!==ps.length)throw new Error("La copia contiene productos duplicados");
    if(!confirm(`Restaurar ${ps.length} productos y ${ms.length} movimientos. Sustituirá los datos de esta instalación; se conservará una copia local anterior. ¿Continuar?`))return;
    const previous=JSON.stringify(backupValues());
    const values=Object.fromEntries(backupKeys.map(key=>[key,next[key]??(key===STORE_SETTINGS?"{}":key==="toolstock.owner.v1"?"null":"[]")]));
    values["toolstock.recovery.beforeRestore"]=previous;
    storage.writeBatch(values,true);storageProblems.length=0;location.reload();
  }catch(error){toast(error.message||"No se pudo restaurar la copia");}
  finally{event.target.value="";}
});
if(storageProblems.length){
  $("#app").insertAdjacentHTML("afterbegin",'<div class="card"><h3>Hay datos dañados</h3><p>El contenido original se conserva. Exporta una copia de recuperación y restaura una copia JSON válida para continuar guardando.</p><button id="exportRecovery" class="btn">Guardar datos para recuperación</button></div>');
  $("#exportRecovery").addEventListener("click",()=>saveDownload("ToolStock_recuperacion.json","application/json",new TextEncoder().encode(JSON.stringify({type:"toolstock-recovery",raw:backupValues()},null,2))));
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
initIndustrialSuite({
  getProducts:()=>products,
  getMovements:()=>movements,
  getSettings:()=>settings,
  go,toast,esc
});
const setDriveAccountStatus = (label, linked = Boolean(label)) => {
  const element = document.querySelector("#driveAccountStatus");
  if (element) element.textContent = linked ? `Cuenta de Google: ${label || "vinculada"}` : "Cuenta de Google: no vinculada en este dispositivo.";
};
const driveSync = createDriveSync({
  getSnapshot: () => ({
    schemaVersion: 1,
    clientId: storage.getItem("toolstock.client.v1") || "",
    updatedAt: settings.updatedAt || new Date().toISOString(),
    data: { products, movements, employees, settings }
  }),
  setSnapshot: async snapshot => {
    const data = snapshot?.data;
    if (!data || !Array.isArray(data.products) || !Array.isArray(data.movements) || !Array.isArray(data.employees) || !data.settings || typeof data.settings !== "object") {
      throw new Error("La copia de Drive no tiene el formato de ToolStock");
    }
    products = data.products;
    movements = data.movements;
    employees = data.employees.slice(0, 3);
    settings = { ...defaultSettings, ...data.settings, updatedAt: snapshot.updatedAt || new Date().toISOString() };
    if (snapshot.clientId) storage.setItem("toolstock.client.v1", snapshot.clientId);
    storage.writeBatch({
      [STORE_PRODUCTS]: JSON.stringify(products),
      [STORE_MOVEMENTS]: JSON.stringify(movements),
      [STORE_EMPLOYEES]: JSON.stringify(employees),
      [STORE_SETTINGS]: JSON.stringify(settings)
    });
    applySettings();
    renderEmployeeSummary();
    renderMetrics();
  },
  getAccessToken: async () => {
    if (demoMode) throw new Error("La demo no puede sincronizar datos reales");
    if (window.ToolStockAndroid?.requestDriveAccessToken) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("No se obtuvo autorización de Google Drive")), 30000);
        window.onToolStockDriveToken = (value, error, accountEmail) => {
          clearTimeout(timeout);
          if (error) reject(new Error(error));
          else {
            if (accountEmail) setDriveAccountStatus(accountEmail, true);
            resolve(value);
          }
        };
        const value = window.ToolStockAndroid.requestDriveAccessToken();
        if (typeof value === "string" && value) { clearTimeout(timeout); resolve(value); }
      });
    }
    if (window.ToolStockPC?.getDriveAccessToken) {
      const value = await window.ToolStockPC.getDriveAccessToken();
      setDriveAccountStatus("vinculada en este PC", true);
      return value;
    }
    throw new Error("Vincula tu cuenta de Google en el PC o en el móvil");
  },
  onStatus: state => {
    const status = document.querySelector("#driveSyncStatus");
    if (status) status.textContent = state.message || "Sincronización lista";
    if (state.state === "working") setDriveAccountStatus("comprobando…", true);
    if (state.state === "ready" && state.message) toast(state.message);
  }
});
window.ToolStockDrive = driveSync;
window.onToolStockDriveSync = () => driveSync.sync();
document.querySelector("#driveLogout")?.addEventListener("click", async () => {
  if (!confirm("Esto cerrará la vinculación de Google Drive en este dispositivo. Los datos de Drive no se borrarán. ¿Continuar?")) return;
  try {
    if (window.ToolStockAndroid?.signOutDrive) {
      window.ToolStockAndroid.signOutDrive();
    } else if (window.ToolStockPC?.logout) {
      await window.ToolStockPC.logout();
    } else {
      throw new Error("Este dispositivo no tiene una vinculación de Google Drive activa");
    }
    setDriveAccountStatus("", false);
    const status = document.querySelector("#driveSyncStatus");
    if (status) status.textContent = "Cuenta desvinculada en este dispositivo. Los datos de Drive no se han borrado.";
    toast("Cuenta de Google desvinculada");
  } catch (error) {
    toast(error.message || "No se pudo desvincular la cuenta");
  }
});
document.querySelector("#syncNow")?.addEventListener("click", async () => {
  try { await driveSync.sync(); }
  catch (error) {
    const status = document.querySelector("#driveSyncStatus");
    if (status) status.textContent = error.message;
    toast(error.message || "No se pudo sincronizar");
  }
});
if (window.ToolStockPC?.getStatus) {
  window.ToolStockPC.getStatus().then(state => {
    if (state.linked) setDriveAccountStatus("vinculada en este PC", true);
  }).catch(() => {});
}
if (window.ToolStockAndroid?.driveAccountEmail) {
  try {
    const email = window.ToolStockAndroid.driveAccountEmail();
    if (email) setDriveAccountStatus(email, true);
  } catch {}
}
initLupa();
applySettings();renderEmployeeSummary();renderMetrics();go("home",false);
