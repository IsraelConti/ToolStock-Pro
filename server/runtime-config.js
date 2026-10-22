export const SERVER_CONFIG_NAMES = ["DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
export const DEPLOY_CONFIG_NAMES = ["DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "SYNC_API_BASE"];

export function missingNames(names, env = process.env) {
  return names.filter(name => !String(env?.[name] || "").trim());
}

export function formatMissingServerConfig(names) {
  const list = names.length <= 1 ? names[0] || "" : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  const verb = names.length === 1 ? "Falta" : "Faltan";
  return `${verb} ${list}. El servicio no arranca y no se inventa ninguna sesión.`;
}

export function inspectServerEnv(env = process.env) {
  const missing = missingNames(SERVER_CONFIG_NAMES, env);
  const problems = [];
  const databaseUrl = String(env?.DATABASE_URL || "").trim();
  if (databaseUrl && !/^postgres(ql)?:\/\//i.test(databaseUrl)) problems.push("DATABASE_URL no tiene un esquema postgresql válido.");
  const clientId = String(env?.GOOGLE_CLIENT_ID || "").trim();
  if (clientId && (/\s/.test(clientId) || clientId.includes("://") || clientId.includes("PRIVATE KEY"))) problems.push("GOOGLE_CLIENT_ID no es un identificador de cliente.");
  const play = String(env?.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || "").trim();
  if (play) {
    try {
      const parsed = JSON.parse(play);
      if (!parsed?.client_email || !parsed?.private_key) problems.push("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no tiene los campos client_email y private_key.");
    } catch {
      problems.push("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no es JSON.");
    }
  }
  if (String(env?.PORT || "").trim()) {
    const port = Number(env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push("PORT no es un puerto válido.");
  }
  const pkg = String(env?.PLAY_PACKAGE_NAME || "").trim();
  if (pkg && !/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/.test(pkg)) problems.push("PLAY_PACKAGE_NAME no tiene formato de paquete.");
  return { missing, problems };
}

export function formatServerConfigReport(report) {
  const lines = [];
  if (report.missing.length) lines.push(formatMissingServerConfig(report.missing));
  lines.push(...report.problems);
  lines.push("No se imprime ningún valor.");
  return lines.join("\n");
}
