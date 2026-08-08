export function initIndustrialSuite(ctx) {
  const { getProducts, getMovements, getSettings, go, toast, esc } = ctx;
  const main = document.querySelector("#app");
  if (!main || document.querySelector('[data-screen="assistant"]')) return;
  const OWNER_KEY = "toolstock.owner.v1";
  const PLAY_REVIEW_EMAIL = "toolstock.review.2026@gmail.com";
  const isPlayReviewer = () => owner && owner.email === PLAY_REVIEW_EMAIL;
  const readOwner = () => { try { return JSON.parse(localStorage.getItem(OWNER_KEY) || "null"); } catch { return null; } };
  let owner = readOwner();
  document.body.insertAdjacentHTML("afterbegin", `
    <div id="ownerOnboarding" class="owner-onboarding" role="dialog" aria-modal="true">
      <form id="ownerOnboardingForm" class="owner-onboarding-card">
        <img src="app-icon.png" alt="" class="owner-onboarding-logo">
        <p class="eyebrow">ACTIVACIÓN DEL PROPIETARIO</p>
        <h1>Bienvenido a ToolStock Pro</h1>
        <p>Introduce el correo del propietario antes de acceder. Se guarda únicamente en este dispositivo.</p>
        <label>Correo electrónico del propietario *<input id="ownerEmailInput" name="email" type="email" inputmode="email" autocomplete="email" required placeholder="propietario@gmail.com"></label>
        <label>Nombre o empresa<input name="displayName" autocomplete="organization" placeholder="Nombre del propietario o empresa"></label>
        <label class="owner-consent"><input name="consent" type="checkbox" required> Confirmo que soy el propietario o una persona autorizada.</label>
        <small>La compra se comprueba mediante Google Play. ToolStock Pro no puede leer el correo de compra de Google.</small>
        <button class="btn primary wide" type="submit">Guardar correo y entrar</button>
        <p id="ownerOnboardingError" class="owner-error" aria-live="polite"></p>
      </form>
    </div>`);
  const ownerOverlay = document.querySelector("#ownerOnboarding");
  if (owner && owner.email) ownerOverlay.classList.add("hidden");
  document.body.classList.toggle("owner-registration-required", !(owner && owner.email));
  document.querySelector("#ownerOnboardingForm").addEventListener("submit", e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const email = String(data.email || "").trim().toLowerCase();
    const error = document.querySelector("#ownerOnboardingError");
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { error.textContent = "Introduce un correo electrónico válido."; return; }
    owner = { email, displayName: String(data.displayName || "").trim(), createdAt: new Date().toISOString() };
    localStorage.setItem(OWNER_KEY, JSON.stringify(owner));
    ownerOverlay.classList.add("hidden");
    document.body.classList.remove("owner-registration-required");
    if (isPlayReviewer()) document.body.classList.remove("subscription-locked");
    const display = document.querySelector("#ownerEmailDisplay");
    if (display) display.textContent = owner.email;
    toast("Correo del propietario guardado");
  });

  main.insertAdjacentHTML("beforeend", `
    <section class="screen" data-screen="assistant">
      <p class="eyebrow">INTELIGENCIA INDUSTRIAL LOCAL</p>
      <h2>ToolStock IA</h2>
      <p class="lead">Analiza el inventario y la trazabilidad directamente en este dispositivo. No envía productos, empleados ni movimientos a servidores externos.</p>
      <div id="industrialHealth" class="industrial-health"></div>
      <div class="ai-presets">
        <button class="btn" data-ai="critical">¿Qué repuestos ponen en riesgo la producción?</button>
        <button class="btn" data-ai="reorder">¿Qué debo comprar primero?</button>
        <button class="btn" data-ai="dead">¿Qué material está inmovilizado?</button>
        <button class="btn" data-ai="usage">¿Qué se consume más?</button>
        <button class="btn" data-ai="audit">Haz una auditoría rápida</button>
      </div>
      <form id="industrialAiForm" class="form ai-form">
        <label>Pregunta a la asesora local
          <textarea id="industrialAiQuestion" rows="3" placeholder="Ej.: ¿Qué rodamientos debo reponer para la línea 2?"></textarea>
        </label>
        <button class="btn primary" type="submit">Analizar inventario</button>
      </form>
      <article id="industrialAiAnswer" class="ai-answer">
        <h3>Diagnóstico inicial</h3><div></div>
      </article>
      <button class="btn wide" data-industrial-back>← Volver</button>
    </section>

    <section class="screen" data-screen="help">
      <p class="eyebrow">INFORMACIÓN Y AYUDA</p>
      <h2>Centro industrial ToolStock Pro</h2>
      <div class="help-grid">
        <details open><summary>Primeros pasos</summary><p>Registra cada repuesto con referencia única, fabricante, referencia OEM, equipo compatible, ubicación, stock mínimo, criticidad y plazo de entrega. Después registra cada entrada y salida para mantener la trazabilidad.</p></details>
        <details><summary>ToolStock IA local</summary><p>La asesora cruza stock, mínimos, criticidad, valor, plazo de entrega y movimientos. Funciona con reglas industriales en el dispositivo y no transmite el inventario a un servicio externo.</p></details>
        <details><summary>Criticidad de repuestos</summary><p>Crítica: puede detener producción o afectar seguridad/calidad. Alta: reduce capacidad o genera una parada relevante. Media: existe alternativa temporal. Baja: consumible o material fácil de conseguir.</p></details>
        <details><summary>Reposición y mínimos</summary><p>Define el mínimo considerando consumo, plazo de entrega, redundancia y consecuencias de rotura. Revisa especialmente los repuestos críticos sin existencias y los que tengan plazos largos.</p></details>
        <details><summary>Movimientos y auditoría</summary><p>Registra quién retira o entrega, cantidad, destino, equipo u orden de trabajo y observaciones. Las correcciones deben hacerse como ajustes trazables.</p></details>
        <details><summary>QR y códigos de barras</summary><p>Genera etiquetas QR por repuesto. En Android, el escáner local permite buscar referencias QR, EAN, UPC y códigos internos sin almacenar imágenes.</p></details>
        <details><summary>Drive y copias</summary><p>Vincula una carpeta elegida por el propietario y conserva copias periódicas. La selección de carpeta concede acceso únicamente al destino escogido por el usuario.</p></details>
        <details><summary>Usuarios</summary><p>El propietario puede preparar hasta tres empleados con rol de encargado, operario o consulta. Comprueba los permisos antes de compartir documentos o carpetas.</p></details>
        <details><summary>Privacidad</summary><p>El inventario y los movimientos permanecen localmente salvo las exportaciones o carpetas que el usuario elija. Google Play procesa la suscripción. La app no vende datos ni incluye publicidad o analítica.</p></details>
        <details><summary>Limitaciones</summary><p>ToolStock Pro ayuda a controlar repuestos, pero no sustituye inspecciones técnicas, evaluación de riesgos, LOTO, normativa, homologación del fabricante ni decisiones de seguridad.</p></details>
      </div>
      <div class="card owner-identity-card"><h3>Propietario de esta instalación</h3><p id="ownerEmailDisplay">${esc(owner && owner.email ? owner.email : "Sin registrar")}</p><button id="changeOwnerEmail" class="btn">Cambiar correo del propietario</button></div>\n      <div class="card subscription-card"><h3>ToolStock Pro Premium</h3><p id="toolStockSubscriptionStatus">Comprobando Google Play…</p><p><strong>3 días gratuitos</strong> para clientes nuevos elegibles; después, 4,99 € al mes.</p><div class="subscription-actions"><button id="toolStockSubscribe" class="btn primary">Suscribirme</button><button id="toolStockRestore" class="btn">Restaurar compra</button><button id="toolStockManage" class="btn">Gestionar</button></div></div>
      <button class="btn wide" data-industrial-back>← Volver</button>
    </section>
  `);

  document.querySelectorAll("[data-industrial-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.industrialGo)));
  document.querySelectorAll("[data-industrial-back]").forEach(b => b.addEventListener("click", () => document.querySelector("#backBtn")?.click()));

  const productsScreen = document.querySelector('[data-screen="products"] .section-head');
  if (productsScreen && !document.querySelector("#scanIndustrialCode")) {
    productsScreen.insertAdjacentHTML("beforeend", '<button id="scanIndustrialCode" class="btn">▣ Escanear</button>');
    document.querySelector("#scanIndustrialCode").addEventListener("click", () => {
      if (window.ToolStockAndroid?.scanCode) window.ToolStockAndroid.scanCode();
      else toast("El escáner está disponible en la aplicación Android");
    });
  }

  window.onToolStockCodeScanned = value => {
    const search = document.querySelector("#searchProducts");
    go("products");
    if (search) {
      search.value = value || "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
    toast(value ? "Código leído: " + value : "No se obtuvo ningún código");
  };

  const normalize = v => String(v ?? "").toLowerCase();
  const n = v => Number(v) || 0;
  const criticality = p => normalize(p.criticality || "medium");
  const leadDays = p => n(p.leadTimeDays);
  const lastMovementByProduct = () => {
    const map = new Map();
    getMovements().forEach(m => {
      const key = m.productId || m.reference;
      if (!map.has(key)) map.set(key, new Date(m.createdAt || 0));
    });
    return map;
  };
  const score = p => {
    const stock = n(p.stock), min = n(p.minimumStock);
    let value = stock <= 0 ? 50 : stock <= min ? 32 : 0;
    value += ({ critical: 40, high: 28, medium: 14, low: 4 })[criticality(p)] || 14;
    value += leadDays(p) >= 60 ? 18 : leadDays(p) >= 30 ? 10 : leadDays(p) >= 14 ? 5 : 0;
    return value;
  };
  const label = p => `${esc(p.name || "Sin nombre")} (${esc(p.reference || "sin referencia")})`;
  const orderedRisk = () => [...getProducts()].sort((a,b) => score(b)-score(a));

  function health() {
    const ps = getProducts();
    const low = ps.filter(p => n(p.stock) <= n(p.minimumStock));
    const stopped = ps.filter(p => n(p.stock) <= 0 && ["critical","high"].includes(criticality(p)));
    const longLead = ps.filter(p => leadDays(p) >= 30 && n(p.stock) <= n(p.minimumStock));
    const scoreValue = ps.length ? Math.max(0, 100 - stopped.length*18 - low.length*4 - longLead.length*5) : 0;
    const el = document.querySelector("#industrialHealth");
    if (el) el.innerHTML = `<article><small>Salud del almacén</small><strong>${scoreValue}%</strong></article><article><small>Riesgo de parada</small><strong>${stopped.length}</strong></article><article><small>Reposición</small><strong>${low.length}</strong></article><article><small>Plazo largo</small><strong>${longLead.length}</strong></article>`;
    return { ps, low, stopped, longLead, scoreValue };
  }

  function answer(kind, question="") {
    const { ps, low, stopped, longLead, scoreValue } = health();
    const movements = getMovements();
    const q = normalize(question);
    let title = "Diagnóstico industrial";
    let lines = [];
    if (!ps.length) {
      lines = ["Todavía no hay repuestos registrados.", "Empieza importando el inventario o creando una ficha completa."];
    } else if (kind === "critical" || /crít|parada|riesgo|producción/.test(q)) {
      title = "Riesgo de parada";
      const rows = orderedRisk().filter(p => score(p) >= 45).slice(0,8);
      lines = rows.length ? rows.map(p => `${label(p)}: stock ${n(p.stock)}, mínimo ${n(p.minimumStock)}, criticidad ${esc(p.criticality || "media")}, plazo ${leadDays(p) || "sin definir"} días.`) : ["No se detectan repuestos con riesgo alto según los datos actuales."];
    } else if (kind === "reorder" || /compr|reponer|pedido|mínimo|falta/.test(q)) {
      title = "Compra prioritaria";
      const rows = orderedRisk().filter(p => n(p.stock) <= n(p.minimumStock)).slice(0,10);
      lines = rows.length ? rows.map((p,i) => `${i+1}. ${label(p)}: comprar al menos ${Math.max(1, n(p.minimumStock)*2-n(p.stock))} ${esc(p.unit || "unidades")}.`) : ["El stock registrado está por encima de los mínimos."];
    } else if (kind === "dead" || /inmov|sin movimiento|obsole|exceso/.test(q)) {
      title = "Stock inmovilizado";
      const last = lastMovementByProduct(), now = Date.now();
      const rows = ps.filter(p => {
        const d = last.get(p.id) || last.get(p.reference);
        return n(p.stock) > n(p.minimumStock)*2 && (!d || now-d.getTime() > 180*86400000);
      }).sort((a,b)=>n(b.stock)*n(b.unitPrice)-n(a.stock)*n(a.unitPrice)).slice(0,10);
      lines = rows.length ? rows.map(p => `${label(p)}: ${n(p.stock)} ${esc(p.unit || "unidades")}, valor estimado ${(n(p.stock)*n(p.unitPrice)).toFixed(2)}.`) : ["No se detecta exceso claro con los datos disponibles."];
    } else if (kind === "usage" || /consum|usad|salida|retir/.test(q)) {
      title = "Consumo y utilización";
      const totals = new Map();
      movements.filter(m => n(m.delta) < 0).forEach(m => totals.set(m.reference || m.productId, (totals.get(m.reference || m.productId)||0)+Math.abs(n(m.delta))));
      const rows = [...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
      lines = rows.length ? rows.map(([ref,total],i)=>`${i+1}. ${esc(ref)}: ${total} unidades consumidas/retiradas.`) : ["Aún no hay suficientes salidas registradas para calcular consumo."];
    } else {
      title = "Auditoría rápida";
      lines = [
        `Salud estimada del almacén: ${scoreValue}%.`,
        `${stopped.length} repuestos críticos o altos sin existencias.`,
        `${low.length} referencias en mínimo o por debajo.`,
        `${longLead.length} referencias con reposición urgente y plazo de 30 días o más.`,
        `${ps.filter(p=>!p.location).length} productos sin ubicación y ${ps.filter(p=>!p.supplier).length} sin proveedor.`,
        "Prioridad recomendada: completar datos críticos, pedir faltantes y revisar mínimos con mantenimiento y producción."
      ];
    }
    const target = document.querySelector("#industrialAiAnswer");
    if (target) target.innerHTML = `<h3>${title}</h3><div><ul>${lines.map(x=>`<li>${x}</li>`).join("")}</ul><small>Análisis local orientativo basado en los datos registrados.</small></div>`;
  }

  document.querySelectorAll("[data-ai]").forEach(b => b.addEventListener("click", () => answer(b.dataset.ai)));
  document.querySelector("#industrialAiForm")?.addEventListener("submit", e => {
    e.preventDefault();
    answer("", document.querySelector("#industrialAiQuestion")?.value || "");
  });

  window.onToolStockSubscription = (active, price, message) => {
    const reviewAccess = isPlayReviewer();
    const unlocked = active || reviewAccess;
    const status = document.querySelector("#toolStockSubscriptionStatus");
    if (status) status.textContent = reviewAccess ? "Acceso de revisión de Google Play" : (active ? "Suscripción activa" : (message || ((price || "4,99 €") + " al mes")));
    document.body.classList.toggle("subscription-locked", !unlocked);
  };
  window.onToolStockOffer = (price, hasTrial) => {
    const status = document.querySelector("#toolStockSubscriptionStatus");
    if (status && !status.textContent.includes("activa")) status.textContent = `${hasTrial ? "3 días gratuitos; después " : ""}${price || "4,99 €"} al mes`;
  };
  window.onToolStockPurchaseError = message => toast(message || "No se pudo completar la operación de Google Play");
  document.querySelector("#changeOwnerEmail")?.addEventListener("click", () => {
    if (!confirm("¿Quieres cambiar el correo del propietario de esta instalación?")) return;
    localStorage.removeItem(OWNER_KEY);
    location.reload();
  });
  document.querySelector("#toolStockSubscribe")?.addEventListener("click", () => window.ToolStockAndroid?.subscribeMonthly?.());
  document.querySelector("#toolStockRestore")?.addEventListener("click", () => window.ToolStockAndroid?.restorePurchases?.());
  document.querySelector("#toolStockManage")?.addEventListener("click", () => window.ToolStockAndroid?.manageSubscription?.());

  health();
  answer("audit");
  if (window.ToolStockAndroid?.checkSubscription) window.ToolStockAndroid.checkSubscription();
  else window.onToolStockSubscription(true, "4,99 €", "Versión web de prueba");
}
