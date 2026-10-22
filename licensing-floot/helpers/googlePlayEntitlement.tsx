import { createHash, createSign } from "node:crypto";
import { sql } from "kysely";
import { db } from "./db";

const PACKAGE_NAME = "com.icapps.maintenpro";
const PRODUCT_ID = "maintenpro_premium_monthly";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export class PlayVerificationError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export type VerifiedEntitlement = { productId: string; subscriptionState: string; expiresAt: Date };
export const hashPurchaseToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

function b64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function getGoogleAccessToken(): Promise<string> {
  const raw = (process.env as Record<string, string | undefined>)["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
  if (!raw) throw new PlayVerificationError("La verificación de Google Play no está configurada.", 503);
  let account: { client_email?: string; private_key?: string; token_uri?: string };
  try { account = JSON.parse(raw); } catch { throw new PlayVerificationError("La configuración de Google Play no es válida.", 503); }
  if (!account.client_email || !account.private_key) throw new PlayVerificationError("Faltan datos de la cuenta de servicio.", 503);
  const tokenUri = "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }));
  const unsigned = header + "." + claim;
  let signature: string;
  try { signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key).toString("base64url"); }
  catch { throw new PlayVerificationError("No se pudo firmar la solicitud de Google Play.", 503); }
  const response = await fetch(tokenUri, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + signature }), signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== "string") throw new PlayVerificationError("Google Play rechazó la autenticación del servidor.", 503);
  return data.access_token as string;
}
export async function verifyMaintenProPurchase(purchaseToken: string, googleSub = ""): Promise<VerifiedEntitlement> {
  if (purchaseToken.length < 20 || purchaseToken.length > 4096) throw new PlayVerificationError("El token de compra no es válido.", 400);
  const accessToken = await getGoogleAccessToken();
  const url = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
    + encodeURIComponent(PACKAGE_NAME) + "/purchases/subscriptionsv2/tokens/" + encodeURIComponent(purchaseToken);
  const response = await fetch(url, { headers: { Authorization: "Bearer " + accessToken }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new PlayVerificationError(
    response.status === 404 || response.status === 400 ? "Google Play no reconoce esta compra de MaintenPro." : "No se pudo comprobar la suscripción en Google Play.",
    response.status === 404 || response.status === 400 ? 403 : 503,
  );
  const purchase = await response.json() as { subscriptionState?: string; externalAccountIdentifiers?: {obfuscatedExternalAccountId?: string}; lineItems?: Array<{ productId?: string; expiryTime?: string }> };
  const bound = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (bound && googleSub && bound !== hashPurchaseToken(googleSub)) throw new PlayVerificationError("La compra corresponde a otra cuenta.", 403);
  const line = purchase.lineItems?.filter(item => item.productId === PRODUCT_ID && item.expiryTime).sort((a,b)=>Date.parse(b.expiryTime || "")-Date.parse(a.expiryTime || ""))[0];
  const expiry = line?.expiryTime ? new Date(line.expiryTime) : null;
  const state = purchase.subscriptionState || "UNKNOWN";
  const active = state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD";
  const canceledPaidThrough = state === "SUBSCRIPTION_STATE_CANCELED" && !!expiry && expiry.getTime() > Date.now();
  if (!line || !expiry || !Number.isFinite(expiry.getTime()) || (!active && !canceledPaidThrough) || expiry.getTime() <= Date.now()) {
    throw new PlayVerificationError("No hay una suscripción MaintenPro activa en Google Play.", 403);
  }
  return { productId: PRODUCT_ID, subscriptionState: state, expiresAt: expiry };
}
export function entitlementIsCurrent(row: { subscriptionState: string; expiresAt: Date | string | null }) {
  const expiry = row.expiresAt instanceof Date ? row.expiresAt : row.expiresAt ? new Date(row.expiresAt) : null;
  return !!expiry && Number.isFinite(expiry.getTime()) && expiry.getTime() > Date.now()
    && ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(row.subscriptionState);
}

export class SubscriptionRequiredError extends Error {}

export async function assertCurrentMaintenProEntitlement(userId: number) {
  const row = await db.transaction().execute(async trx => {
    await sql`select set_config('app.user_id', ${String(userId)}, true)`.execute(trx);
    return trx.selectFrom("subscriptionEntitlements")
      .select(["subscriptionState", "expiresAt"])
      .where("userId", "=", userId)
      .executeTakeFirst();
  });
  if (!row || !entitlementIsCurrent(row)) throw new SubscriptionRequiredError("Suscripción MaintenPro no activa.");
  return row;
}

