import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { authorizationUrl, createPkce, exchangeAuthorizationCode } from "./pkce.mjs";
import { createTokenVault } from "./token-vault.mjs";
import { createGoogleDriveRpc, DRIVE_SCOPE } from "../src/google-drive-rpc.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = existsSync(join(here, "index.html")) ? here : join(here, "dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const secret = () => randomBytes(32).toString("base64url");
const equals = (a, b) => typeof a === "string" && typeof b === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function openChrome(url) {
  if (process.platform !== "win32") return;
  const choices = [join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"), join(process.env.ProgramFiles || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"), join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe")];
  const chrome = choices.find(existsSync);
  if (!chrome) throw new Error("Google Chrome no está instalado para este equipo");
  spawn(chrome, [`--app=${url}`, "--new-window"], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}
function safeBase(value) {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash ? u.href.replace(/\/$/, "") : ""; } catch { return ""; }
}
async function body(request) {
  let count = 0; const chunks = [];
  for await (const chunk of request) { count += chunk.length; if (count > 21 * 1024 * 1024) throw new Error("payload-too-large"); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { throw new Error("invalid-json"); }
}
export async function startDesktopSession({ config = {}, clientId, apiBase, port = 41791, root = defaultRoot, fetchImpl = globalThis.fetch, openImpl = openChrome, vault = null } = {}) {
  const desktopClientId = config.desktopClientId || clientId || "";
  const clientSecret = config.desktopClientSecret || "";
  const remote = safeBase(config.entitlementBase || apiBase);
  const configured = Boolean(desktopClientId && remote);
  const cookie = secret(), csrf = secret(), bootstrap = secret();
  const bootstrapUntil = Date.now() + 120000;
  let bootstrapUsed = false, pending = null, session = null, checkedAt = 0, active = false, refreshing = null;
  const saved = vault ? await vault.load() : null;
  if (saved?.refreshToken) session = { ...saved, accessToken: "", expiresAt: 0 };
  async function token() {
    if (!session) return "";
    if (session.accessToken && session.expiresAt > Date.now() + 60000) return session.accessToken;
    if (!session.refreshToken) return "";
    if (!refreshing) refreshing = (async () => {
      const form = { client_id: desktopClientId, refresh_token: session.refreshToken, grant_type: "refresh_token" };
      if (clientSecret) form.client_secret = clientSecret;
      const reply = await fetchImpl("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form), signal: AbortSignal.timeout(30000) });
      if (!reply.ok) { session = null; active = false; await vault?.clear(); return ""; }
      const result = await reply.json();
      if (!result.access_token) return "";
      session = { ...session, accessToken: result.access_token, idToken: result.id_token || "", expiresAt: Date.now() + (Number(result.expires_in) || 3600) * 1000 };
      return session.accessToken;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function entitlement() {
    if (!configured || !session) return false;
    if (checkedAt > Date.now() - 300000) return active;
    active = false;
    const access = await token();
    if (!access) return false;
    try {
      const reply = await fetchImpl(`${remote}/v1/entitlement`, { headers: { authorization: `Bearer ${session.idToken || access}`, accept: "application/json" }, signal: AbortSignal.timeout(25000) });
      const result = reply.ok ? await reply.json() : null;
      active = result?.entitlement?.active === true && result.entitlement.serverValidated === true && result.entitlement.productId === "maintenpro_premium_monthly";
      checkedAt = Date.now();
    } catch { active = false; }
    return active;
  }
  async function status() {
    const access = configured ? await token().catch(() => "") : "";
    const entitled = access ? await entitlement() : false;
    return { configured, connected: Boolean(access), accountId: access ? session?.accountId || "" : "", email: access ? session?.email || "" : "", entitled };
  }
  const rpc = createGoogleDriveRpc({ getAccessToken: token, getSession: status, ensureEntitlement: entitlement, fetchImpl });
  const server = createServer(async (request, response) => {
    const local = `http://127.0.0.1:${server.address().port}`;
    const send = (statusCode, value, headers = {}) => { response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers }); response.end(Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value)); };
    // Google returns through a cross-site top-level navigation. Lax allows its
    // redirect to reach the app; POST requests still require Origin and CSRF.
    const setCookie = () => `mp_session=${cookie}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`;
    try {
      if (request.headers.host !== `127.0.0.1:${server.address().port}`) return send(403, { error: "invalid-host" });
      const url = new URL(request.url || "/", local);
      if (url.pathname === "/health" && request.method === "GET") return send(200, { app: "maintenpro.pc", version: "1.2.9" });
      if (url.pathname === "/open") {
        if (bootstrapUsed || Date.now() > bootstrapUntil || !equals(url.searchParams.get("key"), bootstrap)) return send(403, { error: "invalid-session" });
        bootstrapUsed = true;
        return send(302, "", { location: "/", "set-cookie": setCookie() });
      }
      if (url.pathname === "/callback") {
        const current = pending; pending = null;
        if (!current || Date.now() - current.createdAt > 300000 || !equals(url.searchParams.get("state"), current.state) || !url.searchParams.get("code")) return send(401, { error: "invalid-state" });
        const result = await exchangeAuthorizationCode({ clientId: desktopClientId, clientSecret, code: url.searchParams.get("code"), verifier: current.verifier, redirectUri: `${local}/callback`, fetchImpl });
        if (!result.accessToken || !result.scope.split(" ").includes(DRIVE_SCOPE)) return send(401, { error: "authorization-required" });
        const profileReply = await fetchImpl("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { authorization: `Bearer ${result.accessToken}` }, signal: AbortSignal.timeout(20000) });
        const profile = profileReply.ok ? await profileReply.json() : null;
        if (!profile?.sub || profile.email_verified !== true) return send(401, { error: "identity-unverified" });
        session = { accessToken: result.accessToken, idToken: result.idToken, refreshToken: result.refreshToken, expiresAt: Date.now() + result.expiresIn * 1000, accountId: profile.sub, email: profile.email || "" };
        active = false; checkedAt = 0;
        if (vault && result.refreshToken) await vault.save({ refreshToken: result.refreshToken, accountId: profile.sub, email: profile.email || "" });
        return send(302, "", { location: "/", "set-cookie": setCookie() });
      }
      const cookies = Object.fromEntries(String(request.headers.cookie || "").split(";").map(p => p.trim().split("=")));
      if (!equals(cookies.mp_session, cookie)) return send(403, { error: "session-required" });
      if (request.method === "POST" && (request.headers.origin !== local || !equals(request.headers["x-maintenpro-csrf"], csrf))) return send(403, { error: "invalid-origin" });
      if (url.pathname === "/session/status" && request.method === "GET") return send(200, { ...await status(), csrf });
      if (url.pathname === "/session/start" && request.method === "GET") {
        if (!configured) return send(503, { error: "configuration-missing" });
        pending = { ...createPkce(), createdAt: Date.now() };
        return send(302, "", { location: authorizationUrl({ clientId: desktopClientId, redirectUri: `${local}/callback`, challenge: pending.challenge, state: pending.state }) });
      }
      if (url.pathname === "/session/disconnect" && request.method === "POST") {
        const old = session; session = null; active = false; checkedAt = 0; pending = null;
        await vault?.clear();
        if (old?.refreshToken || old?.accessToken) await fetchImpl("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: old.refreshToken || old.accessToken }), signal: AbortSignal.timeout(15000) }).catch(() => {});
        return send(200, { ok: true });
      }
      if (url.pathname === "/drive/rpc" && request.method === "POST") return send(200, { ok: true, result: await rpc(await body(request)) });
      if (request.method !== "GET") return send(404, { error: "not-found" });
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return send(400, { error: "invalid-path" }); }
      const safeRoot = resolve(root), requested = pathname.replace(/^[/\\]+/, ""), file = resolve(safeRoot, requested || "index.html"), rel = relative(safeRoot, file);
      if (rel.startsWith("..") || isAbsolute(rel) || !types[extname(file)]) return send(404, { error: "not-found" });
      let data;
      try { data = await readFile(file); } catch { return send(404, { error: "not-found" }); }
      if (extname(file) === ".html") data = Buffer.from(data.toString().replace("</head>", "<script>window.MaintenProDesktopBroker=true;</script></head>"));
      return send(200, data, { "content-type": types[extname(file)] });
    } catch (error) {
      const allowed = new Set(["configuration-missing", "sign-in-required", "purchase-required", "authorization-required", "invalid-operation", "invalid-request", "invalid-document", "invalid-file", "invalid-json", "payload-too-large", "too-many-devices", "drive-file-missing", "wrong-device-file", "quota-exceeded"]);
      const reason = allowed.has(error?.message) ? error.message : "drive-unreachable";
      send(reason === "payload-too-large" ? 413 : 400, { ok: false, error: reason });
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const launchUrl = `${url}open?key=${bootstrap}`;
  try { openImpl(launchUrl); } catch (error) { server.close(); throw error; }
  return { server, url, launchUrl };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const configFile = join(here, "maintenpro.runtime.json");
  let config = {};
  try { config = JSON.parse(await readFile(configFile, "utf8")); } catch { /* UI displays the missing setup without sending data */ }
  const dataDir = join(process.env.LOCALAPPDATA || here, "MaintenPro", "Session");
  const vault = createTokenVault(join(dataDir, "google-session.dpapi"));
  startDesktopSession({ config, vault }).catch(async error => {
    if (error.code === "EADDRINUSE") {
      try {
        const reply = await fetch("http://127.0.0.1:41791/health", { signal: AbortSignal.timeout(2000) });
        if ((await reply.json()).app === "maintenpro.pc") { openChrome("http://127.0.0.1:41791/"); return; }
      } catch { /* display the bounded startup failure */ }
    }
    console.error("No se pudo iniciar MaintenPro PC. Comprueba Chrome y el puerto local 41791. Los datos anteriores no se han borrado.");
    process.exitCode = 1;
  });
}
