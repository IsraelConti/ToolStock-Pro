const GUIDE = [
  {
    id: "products",
    title: "Productos y repuestos",
    keys: ["producto","repuesto","material","referencia","crear","editar","eliminar","alta"],
    answer: "Para crear un repuesto abre Productos y pulsa Nuevo. La referencia debe ser única. Para cambiar el stock usa Movimientos; así queda trazado quién hizo la entrada, salida o ajuste."
  },
  {
    id: "movements",
    title: "Movimientos y órdenes",
    keys: ["movimiento","entrada","salida","consumo","préstamo","devolución","ajuste","orden","orden de trabajo"],
    answer: "ToolStock registra el trabajo de almacén como un movimiento: elige el repuesto, el tipo, la cantidad, el responsable y el destino. Una salida resta stock; una entrada o devolución lo suma; un ajuste fija el stock contado y conserva el historial."
  },
  {
    id: "import",
    title: "Importar Excel o CSV",
    keys: ["excel","csv","importar","plantilla","archivo","cargar"],
    answer: "En Importar materiales selecciona un Excel o CSV. Revisa la vista previa y confirma. La referencia decide si una fila crea un producto o actualiza uno existente. Usa Descargar plantilla cuando prepares un archivo nuevo."
  },
  {
    id: "reports",
    title: "Informes",
    keys: ["informe","informes","report","exportar","excel","precios"],
    answer: "En Informes puedes exportar el inventario completo o solo el stock bajo mínimo. El archivo se genera en Excel con los campos del inventario; si ocultas precios en Ajustes, tampoco aparecen en el informe."
  },
  {
    id: "print",
    title: "Imprimir documentos",
    keys: ["imprimir","impresora","impresión","printer","etiqueta","qr","documento"],
    answer: "En Etiquetas QR selecciona los repuestos y pulsa Generar e imprimir. En PC se abrirá el diálogo real de impresión para elegir la impresora instalada; en Android se usa el servicio de impresión del sistema. Los informes se exportan primero y luego se imprimen desde su visor."
  },
  {
    id: "backup",
    title: "Copias y recuperación",
    keys: ["copia","backup","seguridad","restaurar","recuperar","json","perder"],
    answer: "En Ajustes > Copias de seguridad exporta la copia completa. Incluye productos, movimientos, configuración y equipo. Para recuperar, selecciona una copia JSON válida; la aplicación conserva una copia previa antes de sustituir los datos."
  },
  {
    id: "drive",
    title: "Sincronizar móvil y PC",
    keys: ["drive","google","sincronizar","sincronización","móvil","movil","pc","ordenador","ordenador"],
    answer: "La actualización usa la misma cuenta de Google en el móvil y en el PC. Cada cliente guarda su archivo en el espacio privado appDataFolder de esa cuenta; no se mezclan datos entre clientes. Pulsa Sincronizar ahora después de iniciar sesión en ambos dispositivos."
  },
  {
    id: "subscription",
    title: "Suscripción y restauración",
    keys: ["pago","compra","suscripción","suscripcion","premium","restaurar compra","google play"],
    answer: "La suscripción se valida con Google Play y desbloquea el inventario real. La demo no compra nada. Si cambias de dispositivo, usa Restaurar compras con la misma cuenta de Google Play."
  },
  {
    id: "lupa",
    title: "Qué es Lupa",
    keys: ["lupa","ayuda","asistencia","cómo funciona","como funciona"],
    answer: "Soy Lupa, la guía local de ToolStock. Mi información está incluida en la aplicación y funciona sin conexión ni llamadas a una IA externa. Puedes preguntarme por productos, movimientos, informes, copias, impresión, Drive o la suscripción."
  }
];

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[char]));

function normalize(value) {
  return String(value ?? "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findAnswers(question) {
  const text = normalize(question).trim();
  if (!text) return GUIDE.slice(0, 4);
  const terms = text.split(/\s+/).filter(term => term.length > 2);
  return GUIDE.map(item => ({
    item,
    score: item.keys.reduce((score, key) => {
      const candidate = normalize(key);
      return score + (text.includes(candidate) ? (candidate.length > 5 ? 3 : 1) : 0);
    }, 0) + terms.filter(term => item.title.toLocaleLowerCase().includes(term)).length
  })).filter(entry => entry.score > 0).sort((a,b) => b.score - a.score).slice(0, 3).map(entry => entry.item);
}

function contextualAnswer() {
  const screen = document.querySelector(".screen.active")?.dataset.screen;
  const match = GUIDE.find(item => item.id === screen);
  return match ? match.answer : GUIDE.find(item => item.id === "lupa").answer;
}

function ensureStyles() {
  if (document.getElementById("lupaStyles")) return;
  const style = document.createElement("style");
  style.id = "lupaStyles";
  style.textContent = `
    #lupaLauncher{position:fixed;right:18px;bottom:88px;z-index:40;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:#f2b84b;color:#071018;padding:10px 15px;font:700 14px/1 system-ui;box-shadow:0 8px 24px rgba(0,0,0,.28);cursor:pointer}
    #lupaPanel{position:fixed;right:18px;bottom:144px;width:min(390px,calc(100vw - 36px));max-height:min(580px,calc(100vh - 180px));z-index:41;display:none;overflow:auto;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:#101b24;color:#eef5f8;box-shadow:0 18px 50px rgba(0,0,0,.42)}
    #lupaPanel.open{display:block}
    #lupaPanel header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:15px 17px;background:#142633;border-bottom:1px solid rgba(255,255,255,.12)}
    #lupaPanel header b{font-size:17px}
    #lupaPanel header small{display:block;color:#b9c9d0;font-weight:500;margin-top:3px}
    #lupaPanel [data-lupa-close]{border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer}
    #lupaPanel .lupa-body{padding:15px 17px}
    #lupaPanel input{width:100%;box-sizing:border-box;border:1px solid #49606e;border-radius:10px;background:#0a141b;color:#fff;padding:11px 12px;font:inherit}
    #lupaPanel .lupa-answer{margin:13px 0;padding:13px;border-radius:12px;background:#1c3340;line-height:1.45}
    #lupaPanel .lupa-answer b{display:block;color:#f2c768;margin-bottom:5px}
    #lupaPanel .lupa-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
    #lupaPanel .lupa-actions button{border:1px solid #49606e;border-radius:999px;background:transparent;color:#eef5f8;padding:7px 10px;cursor:pointer}
    #lupaPanel .lupa-hint{color:#b9c9d0;font-size:12px;margin:12px 0 0}
    body.light #lupaPanel{background:#fff;color:#15232d;border-color:#cbd7dd}
    body.light #lupaPanel header{background:#edf4f7;border-color:#d5e0e4}
    body.light #lupaPanel input{background:#f8fbfc;color:#15232d;border-color:#a8bac3}
    body.light #lupaPanel .lupa-answer{background:#e7f1f4}
    body.light #lupaPanel .lupa-actions button{color:#15232d;border-color:#a8bac3}
    body.light #lupaLauncher{border-color:#8d671d}
  `;
  document.head.appendChild(style);
}

export function initLupa() {
  if (document.getElementById("lupaLauncher")) return;
  ensureStyles();
  const launcher = document.createElement("button");
  launcher.id = "lupaLauncher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Abrir Lupa, guía local");
  launcher.textContent = "⌕ Lupa";
  const panel = document.createElement("section");
  panel.id = "lupaPanel";
  panel.setAttribute("aria-label", "Lupa, guía local de ToolStock");
  panel.innerHTML = `
    <header><div><b>⌕ Lupa</b><small>Guía local de ToolStock</small></div><button type="button" data-lupa-close aria-label="Cerrar">×</button></header>
    <div class="lupa-body">
      <input id="lupaQuestion" type="search" placeholder="Pregunta: ¿cómo hago una entrada?" autocomplete="off">
      <div id="lupaAnswer" class="lupa-answer"><b>Cómo puedo ayudarte</b><span>${esc(contextualAnswer())}</span></div>
      <div id="lupaActions" class="lupa-actions">${GUIDE.slice(0, 5).map(item => `<button type="button" data-lupa-topic="${item.id}">${esc(item.title)}</button>`).join("")}</div>
      <p class="lupa-hint">Funciona sin conexión. No envía el inventario ni las preguntas fuera del dispositivo.</p>
    </div>`;
  document.body.append(launcher, panel);
  const answer = panel.querySelector("#lupaAnswer");
  const question = panel.querySelector("#lupaQuestion");
  const show = items => {
    const best = items[0];
    answer.innerHTML = best
      ? `<b>${esc(best.title)}</b><span>${esc(best.answer)}</span>`
      : `<b>No encuentro esa instrucción</b><span>Prueba con productos, movimientos, informes, impresión, copias, Drive, PC o suscripción.</span>`;
    panel.querySelector("#lupaActions").innerHTML = (items.length ? items : GUIDE.slice(0,5)).map(item => `<button type="button" data-lupa-topic="${item.id}">${esc(item.title)}</button>`).join("");
  };
  launcher.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) { question.focus(); show(findAnswers(question.value || "")); }
  });
  panel.querySelector("[data-lupa-close]").addEventListener("click", () => panel.classList.remove("open"));
  question.addEventListener("input", () => show(findAnswers(question.value)));
  panel.addEventListener("click", event => {
    const button = event.target.closest("[data-lupa-topic]");
    if (!button) return;
    show(GUIDE.filter(item => item.id === button.dataset.lupaTopic));
  });
  document.addEventListener("click", event => {
    const openButton = event.target.closest("[data-lupa-open]");
    if (openButton) {\n      if (openButton.dataset.industrialGo && event.detail === 0) { panel.classList.remove("open"); return; }\n      event.preventDefault();
      panel.classList.add("open");
      question.focus();
      show(findAnswers(""));
      return;
    }
    const navigation = event.target.closest("[data-go],[data-industrial-go]");
    if (navigation) panel.classList.remove("open");
  });
}
