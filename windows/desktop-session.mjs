import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, normalize, extname, join } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const port = Number(process.env.TOOLSTOCK_PC_PORT || 4173);
const root = resolve(process.env.TOOLSTOCK_PC_DIST || "dist");
const appVersion = process.env.TOOLSTOCK_PC_VERSION || "1.5.0";
const clientId = process.env.TOOLSTOCK_GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.TOOLSTOCK_GOOGLE_CLIENT_SECRET || "";
const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
const scope = "https://www.googleapis.com/auth/drive.appdata";
let oauthState = "";
let accessToken = "";
let refreshToken = "";
let expiresAt = 0;
let linkedAt = 0;

const json = (response, status, value) => {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
};
const html = (response, status, value) => {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(value);
};
const mime = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json", ".png":"image/png", ".svg":"image/svg+xml"
};

async function exchange(params) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params)
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "Google no devolvió un token");
  accessToken = result.access_token;
  if (result.refresh_token) refreshToken = result.refresh_token;
  expiresAt = Date.now() + (Number(result.expires_in) || 3600) * 1000;
  linkedAt = Date.now();
}

async function ensureToken() {
  if (accessToken && Date.now() < expiresAt - 60000) return accessToken;
  if (!refreshToken || !clientId) return "";
  const params = { client_id: clientId, refresh_token: refreshToken, grant_type: "refresh_token" };
  if (clientSecret) params.client_secret = clientSecret;
  await exchange(params);
  return accessToken;
}

function startOAuth(response) {
  if (!clientId) {
    return html(response, 503, "<h1>ToolStock PC</h1><p>Configura TOOLSTOCK_GOOGLE_CLIENT_ID antes de vincular Google Drive.</p>");
  }
  oauthState = randomBytes(18).toString("hex");
  const query = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code",
    access_type: "offline", prompt: "consent", scope, state: oauthState
  });
  response.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${query}` });
  response.end();
}

async function callback(requestUrl, response) {
  const query = new URL(requestUrl, redirectUri).searchParams;
  if (!query.get("state") || query.get("state") !== oauthState) return html(response, 400, "<h1>Estado OAuth no válido</h1>");
  if (query.get("error")) return html(response, 400, `<h1>Autorización cancelada</h1><p>${query.get("error")}</p>`);
  const params = { code: query.get("code") || "", client_id: clientId, redirect_uri: redirectUri, grant_type: "authorization_code" };
  if (clientSecret) params.client_secret = clientSecret;
  try {
    await exchange(params);
    return html(response, 200, "<script>window.close()</script><p>Google Drive vinculado. Ya puedes cerrar esta ventana.</p>");
  } catch (error) {
    return html(response, 502, `<h1>No se pudo vincular Google Drive</h1><p>${String(error.message).replace(/[<>]/g, "")}</p>`);
  }
}

async function serveFile(requestPath, response) {
  const requested = requestPath === "/" ? "/index.html" : requestPath;
  const candidate = normalize(join(root, requested));
  if (!candidate.startsWith(root)) return json(response, 400, { message: "Ruta no válida" });
  try {
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error("not file");
    const body = await readFile(candidate);
    response.writeHead(200, { "Content-Type": mime[extname(candidate)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    if (requested !== "/index.html") return serveFile("/index.html", response);
    json(response, 404, { message: "Ejecuta npm run build antes de abrir ToolStock PC" });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/health") return json(response, 200, {
    ok: true,
    app: "ToolStock PC",
    version: appVersion,
    oauthConfigured: Boolean(clientId),
    driveLinked: Boolean(accessToken && Date.now() < expiresAt)
  });
  if (url.pathname === "/oauth/status") return json(response, 200, {
    configured: Boolean(clientId),
    linked: Boolean(accessToken && Date.now() < expiresAt),
    linkedAt: linkedAt || null,
    expiresAt: expiresAt || null,
    scope
  });
  if (url.pathname === "/oauth/start") return startOAuth(response);
  if (url.pathname === "/oauth/callback") return callback(request.url || "/", response);
  if (url.pathname === "/oauth/access-token") {
    try {
      const token = await ensureToken();
      return token ? json(response, 200, { accessToken: token }) : json(response, 401, { message: "Inicia sesión con Google para sincronizar" });
    } catch (error) {
      return json(response, 502, { message: error.message });
    }
  }
  if (url.pathname === "/oauth/logout") {
    accessToken = ""; refreshToken = ""; expiresAt = 0; linkedAt = 0;
    return json(response, 200, { ok: true });
  }
  return serveFile(url.pathname, response);
});

server.listen(port, "127.0.0.1", () => {
  const address = `http://127.0.0.1:${port}/`;
  console.log(`ToolStock PC disponible en ${address}`);
  if (process.platform === "win32") {
    const browser = process.env.TOOLSTOCK_PC_BROWSER || "chrome.exe";
    spawn("cmd.exe", ["/d", "/c", "start", "", browser, "--new-window", `--app=${address}`], { detached: true, stdio: "ignore" }).unref();
  }
});

const stop = () => server.close(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
