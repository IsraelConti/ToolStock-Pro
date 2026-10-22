import { releaseConfig } from "../scripts/release-config.mjs";
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const release = await releaseConfig();
const out = "windows/dist";
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["src/app.js"], bundle: true, minify: true, sourcemap: false,
  outfile: `${out}/app.js`, target: ["es2020"], format: "iife"
});

let html = await readFile("src/index.html", "utf8");
html = html.replaceAll("app-icon.png", "maintenpro-icon.png")
  .replace("<title>MaintenPro</title>", "<title>MaintenPro para PC</title>")
  .replace('<link rel="manifest" href="manifest.webmanifest">', '')
  .replace('<link rel="stylesheet" href="premium.css">', '<link rel="stylesheet" href="premium.css">\n  <link rel="stylesheet" href="desktop.css">')
  .replace('<h1>Equipos disponibles. Averías bajo control.</h1>', '<h1>Todo el mantenimiento de tu empresa, en una sola pantalla.</h1>')
  .replace('<p>Preventivos, correctivos, técnicos, repuestos, costes y trazabilidad desde el móvil.</p>', '<p>Equipos, órdenes, preventivos e informes desde el ordenador. Conecta la misma cuenta de Google en Móvil y PC para unir los cambios en tu propio Drive.</p>')
  .replace('<span id="todayStatus" class="status">Datos locales protegidos</span>', '<span id="todayStatus" class="status">Datos guardados en este PC</span>')
  .replace(/<button class="icon-btn" data-go="assistant" aria-label="Abrir guía local Sr. Alicate">[\s\S]*?<\/button>/, '')
  .replace('<button class="action ai-action" data-go="assistant"><span><img class="alicatelogo" src="preguntalicates.svg" alt=""></span><b>Sr. Alicate</b><small>Guía local y diagnóstico</small></button>', '<button class="action ai-action" data-go="assistant"><span><img class="pc-action-mascot" src="preguntalicates.svg" alt=""></span><b>Sr. Alicate</b><small>Guía local de MaintenPro</small></button>')
  .replace('<button class="icon-btn" data-go="settings" aria-label="Configuración">⚙</button>', '<div class="desktop-toolbar" role="toolbar" aria-label="Herramientas de escritorio"><button type="button" id="pcPrint" class="btn" title="Preparar e imprimir documentos">⎙ <span>Documentos</span></button><button type="button" id="pcSearch" class="btn" title="Buscar en la aplicación">⌕ <span>Buscar</span></button><button type="button" id="pcTheme" class="btn" title="Elegir tema">◐ <span>Tema</span></button><button type="button" id="pcGuideHelp" class="btn pc-help-button" title="Sr. Alicate, guía de MaintenPro disponible en todas las pantallas" aria-label="Abrir Sr. Alicate, guía de MaintenPro"><img class="pc-help-mascot" src="preguntalicates.svg" alt=""> <span>Sr. Alicate</span></button></div><button class="icon-btn" data-go="settings" aria-label="Configuración">⚙</button>')
html=html.replace('Para usar todas las funciones de MaintenPro se requiere una suscripción mensual. Puedes cerrar esta pantalla y consultar la app en modo limitado. Para registrar o modificar datos necesitas una suscripción.','El PC está incluido con la suscripción activa del móvil. Conecta la misma cuenta de Google que vinculaste en Android para activar el acceso y unir tus datos en tu propio Drive.')
  .replace('id="planHeadline">Suscripción mensual','id="planHeadline">PC incluido con tu suscripción')
  .replace('id="subscriptionPrice">El precio y la moneda se mostrarán en Google Play','id="subscriptionPrice">Una cuenta para móvil y PC')
  .replace('id="subscribeBtn" class="btn primary wide">Continuar con Google Play','id="subscribeBtn" class="btn primary wide">Conectar mi cuenta de Google')
  .replace('id="restorePurchase" class="btn wide">Restaurar compra','id="restorePurchase" class="btn wide">Comprobar acceso')
  .replace('<nav class="bottom-nav">','<nav class="bottom-nav"><button data-go="pc"><span>▣</span>Móvil y PC</button>');
html = html.replace(/<div class="ai-notice"><b>Disponible sin Internet; diagnóstico por reglas<\/b><small>[\s\S]*?<\/small><\/div>/,
  '<div class="ai-notice"><b>Diagnóstico orientativo por reglas</b><small>Esta función analiza síntomas con reglas incluidas en MaintenPro. No es una IA generativa ni confirma una avería; sigue los procedimientos de seguridad y consulta al personal cualificado.</small></div>')
  .replace('<button class="action ai-action" data-go="assistant"><span><img class="alicatelogo" src="preguntalicates.svg" alt=""></span><b>Sr. Alicate</b><small>Guía local y diagnóstico</small></button>', '<button class="action ai-action" data-go="assistant"><span><img class="pc-action-mascot" src="preguntalicates.svg" alt=""></span><b>Sr. Alicate</b><small>Guía y diagnóstico local</small></button>')
  .replace('<button class="btn primary wide">Analizar incidencia</button>', '<button class="btn primary wide">Analizar incidencia</button>')
  .replace('<div id="assistantResult" class="ai-result hidden"></div>', `<div id="assistantResult" class="ai-result hidden"></div>`);
html = html.replace('<p class="eyebrow">DIAGNÓSTICO TÉCNICO POR REGLAS</p><h2>Orientación inicial de una incidencia</h2>', `<section class="card pc-guide" aria-label="Guía local de uso"><div class="pc-guide-search"><label for="pcGuideSearch">¿Qué necesitas hacer?</label><input id="pcGuideSearch" type="search" placeholder="Ej.: imprimir una orden, restaurar copia…" autocomplete="off"><button id="pcGuideClear" class="btn" type="button">Ver todo</button></div><div class="pc-guide-filters" role="group" aria-label="Filtrar temas"><button type="button" class="btn active" data-guide-filter="Todos">Todos</button><button type="button" class="btn" data-guide-filter="Trabajo diario">Trabajo diario</button><button type="button" class="btn" data-guide-filter="Datos e informes">Datos e informes</button><button type="button" class="btn" data-guide-filter="Configuración">Configuración</button></div><div id="pcGuideResults" class="pc-guide-results" aria-live="polite"></div></section><p class="eyebrow">DIAGNÓSTICO POR REGLAS</p><h2>Orientación inicial de una incidencia</h2>`);
// The mobile app's guide search and floating help button duplicated the desktop guide on this screen.
html = html.replace(/\s*<div class="alicateguide">[\s\S]*?<div id="alicateguideResults"[^>]*><\/div><\/div>/, '')
  .replace(/\s*<button class="mobile-alicate-help"[\s\S]*?<\/button>/, '');
for (const [screen, image, caption] of [
  ["equipment", "pc-maintenance-shop.png", "Vista de equipos"], ["equipmentForm", "pc-maintenance-shop.png", "Ficha técnica"],
  ["workForm", "pc-workshop-banner.png", "Parte de avería"], ["orders", "pc-maintenance-shop.png", "Órdenes de trabajo"],
  ["plans", "pc-workshop-banner.png", "Mantenimiento preventivo"], ["calendar", "pc-workshop-banner.png", "Calendario de mantenimiento"],
  ["orderDetail", "pc-maintenance-shop.png", "Detalle de intervención"], ["assistant", "pc-workshop-banner.png", "Asistencia técnica"],
  ["reports", "pc-maintenance-shop.png", "Informes y actividad"], ["settings", "pc-workshop-banner.png", "Configuración del sistema"],
  ["pc", "pc-workshop-banner.png", "Móvil y PC · tu cuenta de Google"], ["team", "pc-maintenance-shop.png", "Equipo técnico"], ["privacy", "pc-workshop-banner.png", "Privacidad y datos"], ["help", "pc-workshop-banner.png", "Centro de ayuda"]
]) {
  const marker = `<section class="screen" data-screen="${screen}">`;
  const replacement = `${marker}\n      <div class="desktop-screen-banner"><img src="${image}" alt=""><span>${caption}</span></div>`;
  html = html.replace(marker, replacement);
}
html = html.replace('<script src="app.js"></script>', '<script>window.MaintenProDesktop=true;</script>\n  <script src="app.js"></script>\n  <script src="desktop.js"></script>');
html = html.replace('<p id="syncStatus" class="lead">Sin configurar.</p>', '<p id="syncStatus" class="lead">Sincronización automática no disponible en esta versión.</p>');
html = html.replace('  <nav class="bottom-nav">', `  <aside class="pc-photo-rail" aria-label="Entorno industrial">
    <figure><img src="pc-maintenance-shop.png" alt="Taller de mantenimiento industrial"><figcaption>Taller de mantenimiento</figcaption></figure>
    <figure><img src="pc-workshop-banner.png" alt="Planta industrial y maquinaria"><figcaption>Entorno de producción</figcaption></figure>
  </aside>
  <nav class="bottom-nav">`);
html = html.replace("</head>", `<script>window.MaintenProRelease=${JSON.stringify({pcDownloadUrl:release.pcDownloadUrl,publicSiteUrl:release.publicSiteUrl}).replaceAll("<", "\\u003c")};</script></head>`);
await writeFile(`${out}/index.html`, html);
for (const file of ["styles.css", "premium.css"]) await cp(`src/${file}`, `${out}/${file}`);
await cp("windows/maintenpro-icon.ico", `${out}/maintenpro-icon.ico`);
for (const file of ["desktop.css", "desktop.js", "manifest.webmanifest", "INICIAR_MAINTENPRO_PC.bat", "README.md", "pc-workshop-banner.png", "pc-maintenance-shop.png", "preguntalicates.svg", "maintenpro-icon.png"]) await cp(`windows/${file}`, `${out}/${file}`);
await build({ entryPoints: ["windows/desktop-session.mjs"], bundle: true, platform: "node", format: "esm", target: ["node24"], outfile: `${out}/desktop-session.mjs` });
await writeFile(`${out}/maintenpro.runtime.json`, JSON.stringify({desktopClientId:release.desktopClientId,desktopClientSecret:release.desktopClientSecret,entitlementBase:release.entitlementBase}, null, 2));
await cp("windows/INICIAR_MAINTENPRO_PC.vbs", `${out}/INICIAR_MAINTENPRO_PC.vbs`);
await mkdir(`${out}/runtime`, {recursive:true});
for (const name of ["node.exe", "LICENSE", "runtime-manifest.json"]) await cp(`windows/runtime-cache/${name}`, `${out}/runtime/${name}`);
console.log(`Built MaintenPro PC ${release.version} in ${out}`);
