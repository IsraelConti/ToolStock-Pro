import { SYNC_PRODUCT_ID } from "../src/sync-contract.js";

const PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const ACTIVE_STATES = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"]);

export function playPackageName() {
  return process.env.PLAY_PACKAGE_NAME || "com.icapps.maintenpro";
}

export async function verifyGoogleIdToken(idToken, clientId = process.env.GOOGLE_CLIENT_ID) {
  const clients = (Array.isArray(clientId) ? clientId : String(clientId || "").split(",")).map(x=>x.trim()).filter(Boolean);
  if (!idToken || !clients.length) return { ok: false, reason: "google-verifier-unconfigured" };
  try {
    const { OAuth2Client } = await import("google-auth-library");
    const auth = new OAuth2Client();
    let payload;
    if (idToken.split('.').length === 3) {
      payload = (await auth.verifyIdToken({ idToken, audience: clients })).getPayload() || {};
    } else {
      const info = await auth.getTokenInfo(idToken);
      if (!clients.includes(info.aud) || info.expiry_date <= Date.now()) return { ok:false, reason:'invalid-token' };
      const reply = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {headers:{authorization:`Bearer ${idToken}`},signal:AbortSignal.timeout(15000)});
      if (!reply.ok) return {ok:false,reason:'invalid-token'};
      payload = await reply.json();
    }
    if (!payload.sub || payload.email_verified !== true) return { ok: false, reason: "invalid-token" };
    return { ok: true, sub: payload.sub, email: payload.email || "" };
  } catch (error) {
    if (error && error.code === "ERR_MODULE_NOT_FOUND") return { ok: false, reason: "google-verifier-unconfigured" };
    return { ok: false, reason: "invalid-token" };
  }
}

export async function serviceAccountAccessToken(credentials, importAuth = () => import("google-auth-library")) {
  try {
    const { GoogleAuth } = await importAuth();
    const auth = new GoogleAuth({ credentials, scopes: [PLAY_SCOPE] });
    const client = await auth.getClient();
    const result = await client.getAccessToken();
    return typeof result === "string" ? result : result?.token || "";
  } catch (error) {
    if (error && error.code === "ERR_MODULE_NOT_FOUND") return "";
    return "";
  }
}

export async function verifyPlayEntitlement({
  purchaseToken = "",
  productId = SYNC_PRODUCT_ID,
  packageName = playPackageName(),
  credentialsJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
  accessToken = "",
  sub = "",
  fetchImpl = globalThis.fetch
} = {}) {
  if (!purchaseToken) return { ok: false, reason: "play-purchase-missing" };
  if (!productId) return { ok: false, reason: "play-product-missing" };
  let credentials = null;
  if (!accessToken) {
    if (!credentialsJson) return { ok: false, reason: "play-not-configured" };
    try {
      credentials = JSON.parse(credentialsJson);
    } catch {
      return { ok: false, reason: "play-not-configured" };
    }
    if (!credentials?.client_email || !credentials?.private_key) return { ok: false, reason: "play-not-configured" };
    accessToken = await serviceAccountAccessToken(credentials);
    if (!accessToken) return { ok: false, reason: "play-not-configured" };
  }
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  let response;
  try {
    response = await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } });
  } catch {
    return { ok: false, reason: "play-unreachable" };
  }
  if (!response?.ok) return { ok: false, reason: "play-product-missing" };
  const body = await response.json();
  const items = Array.isArray(body?.lineItems) ? body.lineItems : [];
  const expiry = Math.max(0, ...items.filter(item=>item?.productId===productId).map(item=>Date.parse(item.expiryTime)||0));
  const matchesProduct = expiry > Date.now();
  if (!ACTIVE_STATES.has(body?.subscriptionState) || !matchesProduct) return { ok: false, reason: "play-product-missing" };
  const bound = body.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (bound && sub) {
    const { createHash } = await import('node:crypto');
    if (bound !== createHash('sha256').update(sub).digest('hex')) return { ok:false,reason:'purchase-account-mismatch' };
  }
  return { ok: true, active: true, productId, expiresAt: new Date(expiry).toISOString() };
}
