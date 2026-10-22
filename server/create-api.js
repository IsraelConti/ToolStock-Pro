import { SYNC_CONTRACT, SYNC_PRODUCT_ID } from "../src/sync-contract.js";
import { applyIncrementalSync } from "./sync-service.js";
import { verifyGoogleIdToken, verifyPlayEntitlement } from "./verify.js";

function bearer(request) {
  const header = request.headers?.authorization || request.headers?.Authorization || "";
  const match = /^Bearer\s+(\S+)$/.exec(String(header));
  return match ? match[1] : "";
}

function headerValue(request, name) {
  const headers = request.headers || {};
  const found = Object.keys(headers).find(key => key.toLowerCase() === name);
  return found ? String(headers[found] || "") : "";
}

export function createApi({ store, verifyGoogle = verifyGoogleIdToken, verifyPlay = verifyPlayEntitlement, clientId = "" }) {
  return {
    async handle(request) {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/v1/health") return { status: 200, body: { ok: true } };
      if (request.method === "POST" && url.pathname === "/v1/session") return session(request);
      if (request.method === "GET" && url.pathname === "/v1/entitlement") return entitlement(request);
      if (request.method === "POST" && url.pathname === "/v1/sync") return sync(request);
      return { status: 404, body: { ok: false, error: "not-found" } };
    }
  };

  function parseBody(request) {
    if (typeof request.body !== "string") return { ok: true, value: request.body };
    try { return { ok: true, value: request.body ? JSON.parse(request.body) : {} }; }
    catch { return { ok: false }; }
  }

  async function identity(request, explicitToken = "") {
    const token = explicitToken || bearer(request);
    if (!token) return { ok: false, status: 401, body: { ok: false, error: "unauthorized", reason: "missing-token" } };
    const verified = await verifyGoogle(token, clientId);
    if (!verified?.ok || !verified.sub) return { ok: false, status: 401, body: { ok: false, error: "unauthorized", reason: verified?.reason || "invalid-token" } };
    return { ok: true, sub: verified.sub, email: verified.email || "" };
  }

  async function authorize(request, explicitToken = "", postedPurchaseToken = "") {
    const user = await identity(request, explicitToken);
    if (!user.ok) return user;
    await store.ensureAccount(user.sub, user.email);
    const sent = postedPurchaseToken || headerValue(request, "x-play-purchase-token");
    const purchaseToken = sent || await store.getPurchaseToken(user.sub);
    const play = await verifyPlay({ sub: user.sub, productId: SYNC_PRODUCT_ID, purchaseToken });
    if (!play?.ok) return { ok: false, status: 401, body: { ok: false, error: "unauthorized", reason: play?.reason || "play-product-missing" } };
    if (sent && await store.setPurchaseToken(user.sub, sent) === false) return {ok:false,status:409,body:{ok:false,error:'purchase-already-linked'}};
    return user;
  }

  async function session(request) {
    const parsed = parseBody(request);
    if (!parsed.ok) return { status: 400, body: { ok: false, error: "invalid-json" } };
    const payload = parsed.value || {};
    const user = await authorize(request, typeof payload.idToken === "string" ? payload.idToken : "", typeof payload.purchaseToken === "string" ? payload.purchaseToken : "");
    if (!user.ok) return { status: user.status, body: user.body };
    return { status: 200, body: { ok: true, entitlement: { active: true, serverValidated: true, productId: SYNC_PRODUCT_ID, reason: "active" } } };
  }

  async function entitlement(request) {
    const user = await authorize(request);
    if (!user.ok) return { status: user.status, body: user.body };
    return { status: 200, body: { ok: true, entitlement: { active: true, serverValidated: true, productId: SYNC_PRODUCT_ID, reason: "active" } } };
  }

  async function sync(request) {
    const user = await authorize(request);
    if (!user.ok) return { status: user.status, body: user.body };
    const parsed = parseBody(request);
    if (!parsed.ok) return { status: 400, body: { ok: false, error: "invalid-json" } };
    const payload = parsed.value;
    if (!payload || payload.contract !== SYNC_CONTRACT) return { status: 400, body: { ok: false, error: "invalid-contract" } };
    if (typeof payload.deviceId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(payload.deviceId)) return { status: 400, body: { ok: false, error: "invalid-device" } };
    const body = await applyIncrementalSync(store, user, payload);
    return { status: 200, body };
  }
}
