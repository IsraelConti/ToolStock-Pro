(()=>{
  const root=document.body;
  const importButton=document.getElementById("pcImportMobile");
  const exportButton=document.getElementById("pcExportMobile");
  importButton?.addEventListener("click",()=>document.getElementById("restoreBackup")?.click());
  exportButton?.addEventListener("click",()=>document.getElementById("backup")?.click());

  const read=(key,fallback=[])=>{try{const state=JSON.parse((sessionStorage.getItem("maintenpro.reviewAccess")==="1"?sessionStorage:localStorage).getItem("maintenpro.state.v3")||"null"),name=key.replace("maintenpro.","");return state&&Object.hasOwn(state,name)?state[name]:(JSON.parse((sessionStorage.getItem("maintenpro.reviewAccess")==="1"?sessionStorage:localStorage).getItem(key))??fallback);}catch{return fallback;}};
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const locale=()=>({es:"es-ES",en:"en-GB",fr:"fr-FR",de:"de-DE",it:"it-IT",pt:"pt-PT"}[read("maintenpro.settings",{}).language]||"es-ES");
  const when=value=>{if(!value)return"—";const d=new Date(/^\d{4}-\d\d-\d\d$/.test(String(value))?`${value}T12:00:00`:value);return Number.isNaN(d.getTime())?esc(value):new Intl.DateTimeFormat(locale(),{dateStyle:"medium"}).format(d);};
  const money=value=>{const chosen=read("maintenpro.settings",{}).currency;return new Intl.NumberFormat(locale(),{style:"currency",currency:["EUR","USD","GBP","MXN"].includes(chosen)?chosen:"EUR"}).format(Number(value)||0);};
  const rows=key=>Array.isArray(read(`maintenpro.${key}`))?read(`maintenpro.${key}`).filter(row=>row&&typeof row==="object"&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(String(row.deletedAt||""))):[];
  const equipment=()=>rows("equipment");
  const orders=()=>rows("orders");
  const plans=()=>rows("plans");
  const company=()=>read("maintenpro.settings",{}).companyName||"MaintenPro";
  const equipFor=id=>equipment().find(x=>x.id===id);

  function documentMenu(){
    document.querySelector(".pc-document-menu")?.remove();
    const menu=document.createElement("div");
    menu.className="pc-document-menu";
    menu.setAttribute("role","dialog");
    menu.setAttribute("aria-label","Preparar documento para imprimir");
    menu.innerHTML=`<b>Preparar documento</b>
      <label>Tipo de documento<select id="pcDocumentKind"><option value="">Selecciona un documento</option><option value="order">Orden de trabajo individual</option><option value="equipment">Ficha técnica de equipo</option><option value="ordersReport">Informe de órdenes</option><option value="equipmentReport">Inventario de equipos</option><option value="plansReport">Plan de preventivos</option><option value="calendarReport">Agenda de preventivos</option></select></label>
      <label id="pcRecordLabel" class="hidden">Registro<select id="pcDocumentRecord"></select></label>
      <button type="button" class="btn primary wide" id="pcPrepareDocument">Vista previa e imprimir</button>
      <small>Se mostrará aquí la vista previa. Desde ella puedes elegir una impresora o Guardar como PDF.</small>`;
    document.querySelector(".topbar")?.append(menu);
    const kind=menu.querySelector("#pcDocumentKind"),recordLabel=menu.querySelector("#pcRecordLabel"),record=menu.querySelector("#pcDocumentRecord");
    kind.addEventListener("change",()=>{
      recordLabel.classList.toggle("hidden",!['order','equipment'].includes(kind.value));
      const list=kind.value==="order"?orders():kind.value==="equipment"?equipment():[];
      record.innerHTML=list.map(x=>{
        const e=kind.value==="order"?equipFor(x.equipmentId):x;
        const title=kind.value==="order"?`${e?.code||""} · ${e?.name||"Equipo"} · ${x.description||x.type||"Orden"}`:`${x.code||""} · ${x.name||"Equipo"}`;
        return `<option value="${esc(x.id)}">${esc(title)}</option>`;
      }).join("");
      if(!list.length&&['order','equipment'].includes(kind.value))record.innerHTML='<option value="">No hay registros</option>';
    });
    menu.querySelector("#pcPrepareDocument").addEventListener("click",()=>{
      const value=kind.value;
      if(!value)return toastMessage("Elige el tipo de documento.");
      if(['order','equipment'].includes(value)&&!record.value)return toastMessage("No hay ningún registro disponible para imprimir.");
      const content=makeDocument(value,record.value);
      if(!content)return toastMessage("No se pudo preparar el documento.");
      openPrintable(content.title,content.body);
      menu.remove();
    });
    menu.querySelector("#pcDocumentKind").focus();
  }

  function table(headers,items){
    if(!items.length)return '<p class="empty">No hay registros para este documento.</p>';
    return `<table><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${items.map(row=>`<tr>${row.map(x=>`<td>${x??"—"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  function makeDocument(kind,id){
    const allOrders=orders(),allEquipment=equipment(),allPlans=plans();
    if(kind==="order"){
      const x=allOrders.find(row=>row.id===id);if(!x)return null;const e=equipFor(x.equipmentId);
      const cost=Number(x.laborCost||0)+Number(x.partsCost||0);
      return {title:`Orden de trabajo · ${e?.code||"MaintenPro"}`,body:`<p class="kicker">ORDEN DE TRABAJO · ${esc(x.type||"Correctivo")}</p><h1>${esc(e?.name||"Equipo")}</h1><p class="sub">Referencia ${esc(String(x.id||"").slice(-8))} · Generada ${when(new Date().toISOString())}</p><section class="facts">${fact("Código",e?.code)}${fact("Ubicación",e?.location||e?.area)}${fact("Estado",x.closedAt?"Finalizada":x.status)}${fact("Prioridad",x.priority)}${fact("Técnico",x.technician||"Sin asignar")}${fact("Fecha límite",when(x.dueDate))}</section><h2>Avería / trabajo solicitado</h2><p class="text">${esc(x.description||"—")}</p><p><b>Impacto:</b> ${esc(x.impact||"No indicado")}</p>${x.photo?`<h2>Fotografía inicial</h2><img class="photo" src="${esc(x.photo)}" alt="Fotografía de la avería">`:""}${x.closedAt?`<h2>Trabajo realizado</h2><p class="text">${esc(x.resolution||"—")}</p><p><b>Repuestos:</b> ${esc(x.parts||"Ninguno")}</p><section class="facts">${fact("Horas",Number(x.laborHours||0))}${fact("Mano de obra",money(x.laborCost))}${fact("Repuestos",money(x.partsCost))}${fact("Coste total",money(cost))}</section>${x.finalPhoto?`<h2>Fotografía final</h2><img class="photo" src="${esc(x.finalPhoto)}" alt="Fotografía final">`:""}`:`<h2>Trabajo realizado</h2><div class="write-lines"></div><h2>Repuestos utilizados</h2><div class="write-lines short"></div><section class="signatures"><span>Firma del técnico</span><span>Conformidad</span></section>`}`};
    }
    if(kind==="equipment"){
      const x=allEquipment.find(row=>row.id===id);if(!x)return null;
      return {title:`Ficha técnica · ${x.code||"Equipo"}`,body:`<p class="kicker">FICHA TÉCNICA DE ACTIVO</p><h1>${esc(x.name||"Equipo")}</h1><p class="sub">Código ${esc(x.code||"—")} · Generada ${when(new Date().toISOString())}</p>${x.photo?`<img class="photo" src="${esc(x.photo)}" alt="Fotografía del equipo">`:""}<section class="facts">${fact("Categoría",x.category)}${fact("Fabricante",x.manufacturer)}${fact("Modelo",x.model)}${fact("N.º de serie",x.serial)}${fact("Año",x.year)}${fact("Centro",x.site)}${fact("Zona / línea",x.area)}${fact("Ubicación",x.location)}${fact("Estado",x.status)}${fact("Criticidad",x.criticality)}${fact("Fecha de alta",when(x.startDate))}${fact("Horas",x.hours)}${fact("Responsable",x.responsible)}${fact("Coste de adquisición",money(x.purchaseCost))}</section><h2>Notas técnicas</h2><p class="text">${esc(x.notes||"—")}</p>`};
    }
    if(kind==="ordersReport")return {title:"Informe de órdenes de trabajo",body:`<p class="kicker">INFORME DE MANTENIMIENTO</p><h1>Órdenes de trabajo</h1><p class="sub">${allOrders.length} registros · ${esc(company())} · ${when(new Date().toISOString())}</p>${table(["Fecha","Equipo","Descripción","Prioridad","Estado","Técnico"],allOrders.map(x=>[when(x.createdAt),esc(equipFor(x.equipmentId)?.name||"Equipo"),esc(x.description||x.type||"—"),esc(x.priority||"—"),esc(x.closedAt?"Finalizada":x.status||"—"),esc(x.technician||"Sin asignar")]))}`};
    if(kind==="equipmentReport")return {title:"Inventario de equipos",body:`<p class="kicker">INFORME DE ACTIVOS</p><h1>Inventario de equipos</h1><p class="sub">${allEquipment.length} registros · ${esc(company())} · ${when(new Date().toISOString())}</p>${table(["Código","Equipo","Fabricante / modelo","Ubicación","Estado","Criticidad"],allEquipment.map(x=>[esc(x.code||"—"),esc(x.name||"—"),esc([x.manufacturer,x.model].filter(Boolean).join(" / ")||"—"),esc(x.location||x.area||"—"),esc(x.status||"—"),esc(x.criticality||"—")]))}`};
    if(kind==="plansReport"||kind==="calendarReport"){
      const sorted=[...allPlans].sort((a,b)=>String(a.nextDate||"").localeCompare(String(b.nextDate||"")));
      return {title:kind==="plansReport"?"Plan de mantenimiento preventivo":"Agenda de preventivos",body:`<p class="kicker">MANTENIMIENTO PREVENTIVO</p><h1>${kind==="plansReport"?"Plan de preventivos":"Agenda de próximos mantenimientos"}</h1><p class="sub">${sorted.length} actuaciones · ${esc(company())} · ${when(new Date().toISOString())}</p>${table(["Próxima fecha","Equipo","Tarea","Frecuencia","Técnico"],sorted.map(x=>[when(x.nextDate),esc(equipFor(x.equipmentId)?.name||"Equipo"),esc(x.title||"—"),`${esc(x.frequency||"—")} días`,esc(x.technician||"Sin asignar")]))}`};
    }
    return null;
  }
  function fact(label,value){return `<div><small>${esc(label)}</small><b>${esc(value||"—")}</b></div>`;}
  function openPrintable(title,body){
    openPrintPreview(title,`<header class="pc-document-brand"><strong>${esc(company())} · MaintenPro</strong><small>${when(new Date().toISOString())}</small></header>${body}<footer class="pc-document-footer">Documento generado desde MaintenPro PC</footer>`);
  }
  function openPrintPreview(title,content){
    closePrintPreview();
    const preview=document.createElement("section");preview.className="pc-print-preview";preview.setAttribute("role","dialog");preview.setAttribute("aria-modal","true");preview.setAttribute("aria-label",`Vista previa: ${title}`);
    preview.innerHTML=`<div class="pc-print-toolbar"><strong>${esc(title)}</strong><div><button type="button" class="btn primary" data-print>Imprimir / Guardar PDF</button><button type="button" class="btn" data-close>Volver a MaintenPro</button></div></div><main class="pc-print-sheet">${content}</main>`;
    preview.querySelector("[data-print]").addEventListener("click",()=>window.print());preview.querySelector("[data-close]").addEventListener("click",closePrintPreview);
    document.body.classList.add("printing-document");document.body.append(preview);preview.querySelector("[data-close]").focus();
  }
  function closePrintPreview(){document.querySelector(".pc-print-preview")?.remove();document.body.classList.remove("printing-document");
  }
  // In the Windows companion, QR printing produces a clean, dedicated label sheet.
  // The mobile build retains its existing print action unchanged.
  const printQr=document.getElementById("printQr");
  if(printQr)printQr.onclick=()=>{
    const image=document.getElementById("qrImage"),title=document.getElementById("qrTitle")?.textContent||"Código QR del equipo",info=document.getElementById("qrInfo")?.textContent||"";
    if(!image?.src||image.src==="")return toastMessage("Primero genera el código QR del equipo.");
    openPrintPreview(`Etiqueta QR · ${title}`,`<article class="pc-qr-label"><h1>${esc(title)}</h1><img src="${esc(image.src)}" alt="Código QR de ${esc(title)}"><p>${esc(info)}</p><small>MaintenPro</small></article>`);
  };
  const toastMessage=message=>{const node=document.getElementById("toast");if(!node)return;node.textContent=message;node.classList.add("show");setTimeout(()=>node.classList.remove("show"),2600);};

  document.getElementById("pcPrint")?.addEventListener("click",documentMenu);
  function closeSearch(){document.querySelector(".pc-search-menu")?.remove();}
  function searchMenu(){
    closeSearch();
    const menu=document.createElement("div");menu.className="pc-search-menu";menu.setAttribute("role","dialog");menu.setAttribute("aria-label","Buscar en MaintenPro");
    menu.innerHTML='<label for="pcGlobalSearch">Buscar equipos, órdenes y preventivos</label><input id="pcGlobalSearch" type="search" autocomplete="off" placeholder="Nombre, código, avería o tarea"><div class="pc-search-results" id="pcSearchResults"><p>Escribe para buscar en tus registros.</p></div>';
    document.querySelector(".topbar")?.append(menu);
    const input=menu.querySelector("#pcGlobalSearch"),results=menu.querySelector("#pcSearchResults");
    const render=()=>{
      const query=input.value.trim().toLocaleLowerCase("es");
      if(!query){results.innerHTML="<p>Escribe para buscar en tus registros.</p>";return;}
      const found=[];
      for(const item of equipment()){const hay=[item.name,item.code,item.category,item.manufacturer,item.model,item.serial,item.site,item.area,item.location].join(" ").toLocaleLowerCase("es");if(hay.includes(query))found.push({kind:"Equipo",title:`${item.code||""} · ${item.name||"Equipo"}`,detail:item.location||item.area||item.site||"",open:()=>{window.MaintenProNavigate?.("equipment");const field=document.getElementById("equipmentSearch");field.value=query;field.dispatchEvent(new Event("input",{bubbles:true}));}});}
      for(const item of orders()){const asset=equipFor(item.equipmentId),hay=[item.description,item.type,item.priority,item.status,item.technician,asset?.name,asset?.code].join(" ").toLocaleLowerCase("es");if(hay.includes(query))found.push({kind:"Orden",title:`${asset?.code||""} · ${asset?.name||"Equipo"}`,detail:item.description||item.type||"",open:()=>window.MaintenProNavigate?.("orderDetail",item.id)});}
      for(const item of plans()){const asset=equipFor(item.equipmentId),hay=[item.title,item.technician,asset?.name,asset?.code].join(" ").toLocaleLowerCase("es");if(hay.includes(query))found.push({kind:"Preventivo",title:`${asset?.code||""} · ${item.title||"Tarea"}`,detail:`${asset?.name||"Equipo"} · ${when(item.nextDate)}`,open:()=>{window.MaintenProNavigate?.("plans");requestAnimationFrame(()=>document.querySelector(`[data-complete-plan="${CSS.escape(String(item.id))}"]`)?.closest(".row")?.scrollIntoView({behavior:"smooth",block:"center"}));}});}
      results.innerHTML=found.length?found.slice(0,30).map((item,index)=>`<button type="button" class="pc-search-result" data-result="${index}"><small>${esc(item.kind)}</small><b>${esc(item.title)}</b><span>${esc(item.detail)}</span></button>`).join(""):'<p>No hay coincidencias.</p>';
      results.querySelectorAll("[data-result]").forEach(button=>button.addEventListener("click",()=>{found[Number(button.dataset.result)]?.open();closeSearch();}));
    };
    input.addEventListener("input",render);input.focus();
  }
  document.getElementById("pcSearch")?.addEventListener("click",searchMenu);

  const saved=(()=>{try{return localStorage.getItem("maintenpro.pc.theme");}catch{return null;}})();
  root.dataset.pcTheme=["dark","light","contrast"].includes(saved)?saved:"dark";
  const themeButton=document.getElementById("pcTheme");
  const closeTheme=()=>document.querySelector(".desktop-theme-menu")?.remove();
  themeButton?.addEventListener("click",()=>{
    const old=document.querySelector(".desktop-theme-menu");if(old){old.remove();return;}
    const menu=document.createElement("div");menu.className="desktop-theme-menu";menu.setAttribute("role","menu");menu.setAttribute("aria-label","Tema de pantalla");
    for(const [value,label,color] of [["dark","Oscuro","#102331"],["light","Claro","#edf3f5"],["contrast","Alto contraste","#000"]]){
      const item=document.createElement("button");item.type="button";item.setAttribute("role","menuitemradio");item.setAttribute("aria-pressed",String(root.dataset.pcTheme===value));item.style.setProperty("--theme-swatch",color);item.textContent=label;
      item.addEventListener("click",()=>{root.dataset.pcTheme=value;try{localStorage.setItem("maintenpro.pc.theme",value);}catch{}closeTheme();});menu.append(item);
    }
    document.querySelector(".topbar")?.append(menu);
  });
  document.addEventListener("click",event=>{
    if(!event.target.closest(".desktop-theme-menu")&&!event.target.closest("#pcTheme"))closeTheme();
    if(!event.target.closest(".pc-document-menu")&&!event.target.closest("#pcPrint"))document.querySelector(".pc-document-menu")?.remove();
    if(!event.target.closest(".pc-search-menu")&&!event.target.closest("#pcSearch"))closeSearch();
  });
  document.addEventListener("keydown",event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="p"){
      event.preventDefault();documentMenu();
    }else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="f"){
      event.preventDefault();document.getElementById("pcSearch")?.click();
    }else if((event.ctrlKey||event.metaKey)&&event.key===","){
      event.preventDefault();document.querySelector('[data-go="settings"]')?.click();
    }else if(event.key==="Escape"){
      closeTheme();document.querySelector(".pc-document-menu")?.remove();closeSearch();closePrintPreview();
    }
  });

  // Static in-app help. Content and search are bundled; no model or network call.
  const guideItems=[
    {title:'Inicio y resumen',category:'Trabajo diario',screen:'home',keywords:'panel avisos indicadores resumen inicio',body:'La pantalla de inicio resume la actividad registrada. Usa los accesos para abrir equipos, averías, órdenes, preventivos e informes. Las cifras reflejan los datos guardados en este PC.'},
    {title:'Equipos y fichas técnicas',category:'Trabajo diario',screen:'equipment',keywords:'activo máquina equipo código serie fabricante qr foto',body:'En Equipos puedes consultar y filtrar activos, abrir una ficha, crear o editar sus datos y generar su etiqueta QR. Completa código, ubicación, estado y criticidad para encontrarlos con facilidad.'},
    {title:'Registrar una avería',category:'Trabajo diario',screen:'workForm',keywords:'correctivo incidencia avería orden nueva crear',body:'Abre Nueva avería, elige el equipo, describe los síntomas y añade prioridad, impacto y técnico si se conocen. Guarda el parte para crear la orden de trabajo.'},
    {title:'Cómo crear una orden de avería',category:'Trabajo diario',screen:'workForm',keywords:'crear crea creo crear hacer hace hago nueva registrar registrar orden averia correctivo parte equipo descripción prioridad impacto técnico foto',body:'En el menú de la izquierda pulsa Avería. En Equipo selecciona la máquina afectada. En Descripción de la avería explica qué ocurre y cómo se detectó. Indica Prioridad y Estado; puedes añadir Fecha límite, Técnico responsable, impacto y una Fotografía. Pulsa Crear orden. Después aparecerá en Órdenes, donde puedes abrirla y, al terminar el trabajo, completar resolución, horas, costes y repuestos antes de finalizarla.'},
    {title:'Órdenes de trabajo y cierre',category:'Trabajo diario',screen:'orders',keywords:'orden trabajo cerrar finalizar resolución repuestos horas coste',body:'En Órdenes consulta el estado y abre el detalle. Al terminar, registra resolución, repuestos, horas y costes antes de cerrar. Comprueba los datos: el cierre deja constancia del trabajo realizado.'},
    {title:'Mantenimiento preventivo',category:'Trabajo diario',screen:'plans',keywords:'plan frecuencia periodicidad vencimiento mantenimiento preventivo',body:'Crea planes vinculados a equipos y define su frecuencia y próxima fecha. La pantalla muestra el calendario de vencimientos; esta edición no envía avisos automáticos.'},
    {title:'Calendario',category:'Trabajo diario',screen:'calendar',keywords:'agenda fecha calendario preventivos vencimiento',body:'Usa el calendario para revisar las fechas de mantenimiento preventivo registradas y abrir la información correspondiente.'},
    {title:'Informes y documentos',category:'Datos e informes',screen:'reports',keywords:'informe excel exportar csv imprimir documento pdf',body:'Informes permite revisar o exportar datos. Para un documento imprimible, pulsa Documentos en la barra superior, selecciona tipo y registro, y abre la vista previa.'},
    {title:'Imprimir en una impresora del ordenador',category:'Datos e informes',screen:'reports',keywords:'impresora imprimir papel dialogo guardar pdf chrome',body:'Pulsa Documentos, prepara el documento y elige Vista previa e imprimir. En el cuadro de impresión de Chrome selecciona la impresora instalada en Windows o “Guardar como PDF”. La app no imprime una captura de pantalla.'},
    {title:'Copias de seguridad e intercambio móvil',category:'Datos e informes',screen:'settings',keywords:'copia json backup restaurar importar exportar móvil drive datos nube guardar',body:'En Configuración, pulsa Guardar copia completa para descargar un archivo JSON con equipos, órdenes, preventivos, técnicos y ajustes. Guarda ese archivo en la carpeta de Drive que quieras. En el otro dispositivo pulsa Restaurar copia JSON y selecciona el archivo. La importación une registros: conserva los que solo están en ese dispositivo y, si un registro existe en los dos, conserva la versión más reciente. En Móvil y PC conecta la misma cuenta de Google que en Android. Los cambios se unen en tu propio Drive; los pendientes se reintentan cuando recuperas conexión. El acceso del PC depende de tu compra activa vinculada desde el móvil.'},
    {title:'Ayuda de Sr. Alicate',category:'Configuración',screen:'assistant',keywords:'señor alicate sr alicate ayuda no funciona simbolo icono',body:'Pulsa el botón con el dibujo de los alicates y la etiqueta Sr. Alicate en la barra superior para abrir la ayuda contextual. Puedes buscar una pregunta, pulsar Ir a esta pantalla o abrir la guía completa. En la pantalla Sr. Alicate, escribe una pregunta o palabras concretas en el buscador; las respuestas están incluidas en el programa y funcionan sin Internet.'},
    {title:'Buscar y cambiar tema',category:'Configuración',screen:'home',keywords:'buscar filtro tema apariencia oscuro claro contraste atajos teclado',body:'Pulsa Buscar para localizar equipos, órdenes y planes. Pulsa Tema y selecciona Oscuro, Claro o Alto contraste; la elección se guarda en este navegador. Atajos: Ctrl+F para buscar, Ctrl+P para preparar documentos y Ctrl+, para abrir Configuración.'},
    {title:'Cerrar una orden de trabajo',category:'Trabajo diario',screen:'orders',keywords:'cerrar cerrar orden finalizar completar resolución trabajo realizado coste precio horas repuesto',body:'Abre Órdenes, filtra por Abiertas y pulsa Abrir en la intervención. En Cerrar intervención escribe el trabajo realizado. Añade horas, mano de obra, repuestos, coste y fotografía final si procede. Pulsa Finalizar orden: la ficha pasa a Finalizada y conserva los costes en el registro.'},
    {title:'Editar o completar un equipo',category:'Trabajo diario',screen:'equipment',keywords:'editar modificar equipo ficha máquina fabricante modelo serie ubicación código abb',body:'En Equipos busca por nombre, código, centro o zona. Abre la ficha del equipo para revisar sus datos técnicos y códigos. Para añadir un activo pulsa Añadir, completa como mínimo nombre y código interno y pulsa Guardar equipo. Usa el campo de notas para referencias del fabricante.'},
    {title:'Crear un plan preventivo',category:'Trabajo diario',screen:'plans',keywords:'plan calendario fecha frecuencia tarea mantenimiento aviso',body:'Abre Preventivos. Selecciona el equipo, escribe la tarea, elige frecuencia y próxima fecha, asigna técnico si se conoce y pulsa Crear plan. Los vencimientos se muestran también en Agenda. Esta versión no envía notificaciones externas.'},
    {title:'Generar y guardar un informe',category:'Datos e informes',screen:'reports',keywords:'informe excel xlsx exportar archivo csv datos',body:'En Informes elige el conjunto de datos y usa el botón de exportación correspondiente para descargar el Excel. Para imprimir, abre Documentos, selecciona Informe de órdenes o Inventario de equipos, pulsa Vista previa e imprimir y desde Chrome elige una impresora o Guardar como PDF.'},
    {title:'Fotografías y espacio de almacenamiento',category:'Datos e informes',screen:'settings',keywords:'foto imagen almacenamiento espacio navegador capacidad copia',body:'Las fotografías se guardan junto al registro en el almacenamiento local de Chrome. Si no puedes guardar, exporta una copia JSON y reduce el tamaño de las imágenes antes de volver a añadirlas. Las copias JSON contienen datos de la empresa: guárdalas solo en una ubicación protegida.'},
    {title:'Qué hace y qué no hace Sr. Alicate',category:'Configuración',screen:'assistant',keywords:'señor alicate ayuda guía inteligencia artificial ia local preguntas respuestas',body:'Sr. Alicate es la guía local incluida en esta versión: busca respuestas en instrucciones incorporadas sobre pantallas y funciones. No es una IA generativa ni aprende conversaciones. Escribe palabras concretas como “cerrar orden”, “imprimir”, “exportar copia” o “código de equipo”.'},
    {title:'Equipo técnico',category:'Configuración',screen:'team',keywords:'técnico operario usuario equipo personas permisos',body:'La lista Equipo técnico ayuda a asignar responsables en los registros. En esta edición local no hay cuentas, permisos individuales ni acceso simultáneo entre ordenadores.'},
    {title:'Configuración y empresa',category:'Configuración',screen:'settings',keywords:'empresa preferencias formato moneda iva configuración',body:'Configura los datos de empresa y preferencias disponibles. Revisa el formato regional y el porcentaje de impuesto de referencia antes de generar documentación.'},
    {title:'Guía de diagnóstico',category:'Trabajo diario',screen:'assistant',keywords:'diagnóstico reglas síntomas causa seguridad ia asistente',body:'Debajo de esta guía, MaintenPro ofrece orientación inicial por reglas a partir de los síntomas indicados. No consulta una IA generativa ni confirma una avería. Valida cualquier hipótesis con personal cualificado y los procedimientos de seguridad de la planta.'},
    {title:'Dónde se guardan los datos',category:'Datos e informes',screen:'privacy',keywords:'local ordenador almacenamiento privacidad datos carpeta',body:'Los datos de trabajo se guardan en el almacenamiento local de Chrome para esta instalación. El desinstalador conserva los datos del navegador. Exporta copias periódicamente y guárdalas en una ubicación segura.'}
  ];
  const mobileGuideSearch=document.getElementById("alicateguideSearch"),mobileGuideResults=document.getElementById("alicateguideResults");
  function renderMobileGuide(){if(!mobileGuideResults)return;const q=normalize(mobileGuideSearch?.value).trim(),words=q.split(/\s+/).filter(Boolean);const hits=guideItems.filter(item=>words.every(word=>normalize(`${item.title} ${item.category} ${item.keywords} ${item.body}`).includes(word)));mobileGuideResults.replaceChildren();if(!hits.length){const empty=document.createElement("p");empty.className="empty";empty.textContent="No encuentro ese tema. Prueba equipo, orden, impresión o copia.";mobileGuideResults.append(empty);return;}for(const item of hits){const card=document.createElement("article");card.className="alicateguide-item";const title=document.createElement("h3");title.textContent=item.title;const body=document.createElement("p");body.textContent=item.body;const link=document.createElement("button");link.type="button";link.className="btn";link.textContent="Abrir pantalla";link.addEventListener("click",()=>window.MaintenProNavigate?.(item.screen));card.append(title,body,link);mobileGuideResults.append(card);}}
  mobileGuideSearch?.addEventListener("input",renderMobileGuide);renderMobileGuide();
  const guideSearch=document.getElementById("pcGuideSearch"),guideResults=document.getElementById("pcGuideResults");
  let guideCategory="Todos";
  const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const stopWords=new Set(["como","que","se","hace","hacer","hago","quiero","necesito","puedo","puede","una","uno","unas","unos","el","la","los","las","un","de","del","en","por","para","me","mi","con","desde","donde","es","esta","este","lo","y","o","a"]);
  const expandQuery=value=>normalize(value).replace(/\b(hace|hacer|hago|crea|crear|creo|abrir|abre|registro|registrar)\b/g," crear ").replace(/\b(parte|averia|incidencia|correctivo)\b/g," averia orden ");
  const tokensOf=value=>expandQuery(value).split(/\s+/).filter(word=>word.length>1&&!stopWords.has(word));
  const wordMatches=(queryWord,contentWord)=>queryWord===contentWord||(queryWord.length>=4&&(contentWord.startsWith(queryWord)||queryWord.startsWith(contentWord)));
  function renderGuide(){
    if(!guideResults)return;
    const words=tokensOf(guideSearch?.value);
    const scored=guideItems.filter(item=>guideCategory==="Todos"||item.category===guideCategory).map(item=>{const content=tokensOf(`${item.title} ${item.keywords} ${item.body}`);const score=words.reduce((total,word)=>total+(content.some(candidate=>wordMatches(word,candidate))?1:0),0);return{item,score};});
    const needed=words.length===0?0:Math.min(2,words.length);
    const hits=scored.filter(row=>row.score>=needed).sort((a,b)=>b.score-a.score).map(row=>row.item);
    guideResults.replaceChildren();
    if(!hits.length){const empty=document.createElement("p");empty.className="pc-guide-empty";empty.textContent="No encontré esa respuesta en la guía local. Prueba con: crear una orden, cerrar orden, equipo, preventivo, imprimir o copia.";guideResults.append(empty);return;}
    for(const item of hits){const card=document.createElement("article");card.className="pc-guide-item";const heading=document.createElement("h3");heading.textContent=item.title;const body=document.createElement("p");body.textContent=item.body;const footer=document.createElement("div");footer.className="pc-guide-item-footer";const category=document.createElement("span");category.textContent=item.category;const button=document.createElement("button");button.type="button";button.className="btn";button.textContent="Abrir pantalla";button.addEventListener("click",()=>window.MaintenProNavigate?.(item.screen));footer.append(category,button);card.append(heading,body,footer);guideResults.append(card);}
  }
  guideSearch?.addEventListener("input",renderGuide);
  document.getElementById("pcGuideClear")?.addEventListener("click",()=>{guideSearch.value="";guideCategory="Todos";document.querySelectorAll("[data-guide-filter]").forEach(button=>button.classList.toggle("active",button.dataset.guideFilter==="Todos"));renderGuide();guideSearch.focus();});
  document.querySelectorAll("[data-guide-filter]").forEach(button=>button.addEventListener("click",()=>{guideCategory=button.dataset.guideFilter;document.querySelectorAll("[data-guide-filter]").forEach(other=>other.classList.toggle("active",other===button));renderGuide();}));
  renderGuide();
  function openContextHelp(){
    document.querySelector(".pc-help-dialog")?.remove();
    const screen=document.querySelector(".screen.active")?.dataset.screen||"home";
    const title=document.getElementById("screenTitle")?.textContent||"MaintenPro";
    const overlay=document.createElement("div");overlay.className="pc-help-dialog";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-labelledby","pcHelpTitle");
    const panel=document.createElement("section");panel.className="pc-help-panel";
    const header=document.createElement("header");header.className="pc-help-header";
    const heading=document.createElement("div"),avatar=document.createElement("img");avatar.className="pc-help-avatar";avatar.src="preguntalicates.svg";avatar.alt="";const h=document.createElement("h2");h.id="pcHelpTitle";h.textContent=`Sr. Alicate · ${title}`;const sub=document.createElement("p");sub.textContent="Guía local de MaintenPro · disponible sin conexión";heading.append(avatar,h,sub);
    const close=document.createElement("button");close.type="button";close.className="btn";close.textContent="Cerrar";close.setAttribute("aria-label","Cerrar ayuda");header.append(heading,close);
    const search=document.createElement("input");search.type="search";search.placeholder="Buscar en la ayuda…";search.setAttribute("aria-label","Buscar en la guía de MaintenPro");
    const results=document.createElement("div");results.className="pc-help-results";results.setAttribute("aria-live","polite");
    const complete=document.createElement("button");complete.type="button";complete.className="btn primary";complete.textContent="Abrir guía completa";
    panel.append(header,search,results,complete);overlay.append(panel);document.body.append(overlay);
    const draw=()=>{const words=tokensOf(search.value);const scored=guideItems.map(item=>{const content=tokensOf(`${item.title} ${item.category} ${item.keywords} ${item.body}`),score=words.reduce((total,word)=>total+(content.some(candidate=>wordMatches(word,candidate))?1:0),0);return{item,score};});const needed=words.length?Math.min(2,words.length):0;const matches=scored.filter(row=>words.length?row.score>=needed:row.item.screen===screen||row.item.screen==="assistant").sort((a,b)=>b.score-a.score).map(row=>row.item);results.replaceChildren();if(!matches.length){const p=document.createElement("p");p.className="pc-guide-empty";p.textContent="No encuentro esa respuesta en la guía local. Prueba: crear una orden, costes, equipo, códigos, preventivo, imprimir o copia.";results.append(p);return;}for(const item of matches){const card=document.createElement("article");card.className="pc-guide-item";const h=document.createElement("h3");h.textContent=item.title;const p=document.createElement("p");p.textContent=item.body;const btn=document.createElement("button");btn.type="button";btn.className="btn";btn.textContent="Ir a esta pantalla";btn.addEventListener("click",()=>{overlay.remove();window.MaintenProNavigate?.(item.screen);});card.append(h,p,btn);results.append(card);}};
    const closeHelp=()=>overlay.remove();close.addEventListener("click",closeHelp);overlay.addEventListener("click",event=>{if(event.target===overlay)closeHelp();});complete.addEventListener("click",()=>{closeHelp();window.MaintenProNavigate?.("assistant");});search.addEventListener("input",draw);draw();search.focus();
    overlay.addEventListener("keydown",event=>{if(event.key==="Escape")closeHelp();});
  }
  document.getElementById("pcGuideHelp")?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();openContextHelp();});
})();
