import { DEPLOY_CONFIG_NAMES } from "../server/runtime-config.js";

const required = DEPLOY_CONFIG_NAMES;
const missing = required.filter(name => !process.env[name]);
const present = required.filter(name => process.env[name]);
console.log(`Presentes: ${present.join(", ") || "(ninguna obligatoria)"}`);
console.log(`Ausentes: ${missing.join(", ") || "(ninguna)"}`);
if (process.env.SYNC_API_BASE && !String(process.env.SYNC_API_BASE).startsWith("https://")) {
  console.log("SYNC_API_BASE no usa https");
  missing.push("SYNC_API_BASE");
}
if (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
  try {
    const parsed = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
    if (!parsed.client_email || !parsed.private_key) console.log("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no tiene los campos client_email y private_key");
  } catch {
    console.log("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no es JSON");
  }
}
if (missing.length) {
  console.log("Configuración incompleta. No se imprime ningún valor.");
  process.exit(1);
}
console.log("Nombres de configuración presentes. No se ha contactado ningún servicio.");
