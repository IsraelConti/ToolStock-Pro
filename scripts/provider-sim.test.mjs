import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { LISTEN_HOST } from "../server/listen.js";
import { serviceAccountAccessToken, verifyPlayEntitlement } from "../server/verify.js";
import { startDesktopSession } from "../windows/desktop-session.mjs";
import { authorizationUrl, createPkce, exchangeAuthorizationCode } from "../windows/pkce.mjs";

assert.equal(LISTEN_HOST, "0.0.0.0");
const indexSource = await readFile(new URL("../server/index.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const desktopSource = await readFile(new URL("../windows/desktop-session.mjs", import.meta.url), "utf8");
const packageSource = await readFile(new URL("../package.json", import.meta.url), "utf8");
assert.match(indexSource, /LISTEN_HOST/);
assert.doesNotMatch(indexSource, /listen\(port,\s*"127\.0\.0\.1"/);
assert.doesNotMatch(appSource, /googleIdToken/);
assert.doesNotMatch(appSource, /authorization:`Bearer/);
assert.doesNotMatch(desktopSource, /localStorage|sessionStorage|writeFile/);
assert.match(packageSource, /"pg"/);
assert.match(packageSource, /"google-auth-library"/);

const pkce = createPkce();
assert.equal(pkce.challenge, createHash("sha256").update(pkce.verifier).digest("base64url"));
const auth = authorizationUrl({ clientId: "client-public", redirectUri: "http://127.0.0.1:9/callback", challenge: pkce.challenge, state: pkce.state });
assert.match(auth, /code_challenge_method=S256/);
assert.equal(auth.includes(pkce.verifier), false);

const exchanged = await exchangeAuthorizationCode({
  clientId: "client-public",
  code: "code-1",
  verifier: pkce.verifier,
  redirectUri: "http://127.0.0.1:9/callback",
  fetchImpl: async (_url, options) => {
    assert.match(String(options.body), /code_verifier=/);
    return { ok: true, json: async () => ({ id_token: "id-token-test" }) };
  }
});
assert.equal(exchanged.idToken, "id-token-test");
const failedExchange = await exchangeAuthorizationCode({
  clientId: "client-public",
  code: "code-1",
  verifier: pkce.verifier,
  redirectUri: "http://127.0.0.1:9/callback",
  fetchImpl: async () => ({ ok: false, json: async () => ({}) })
});
assert.equal(failedExchange.idToken, "");

assert.equal((await verifyPlayEntitlement({ purchaseToken: "", credentialsJson: "" })).reason, "play-purchase-missing");
assert.equal((await verifyPlayEntitlement({ purchaseToken: "purchase-1", credentialsJson: "" })).reason, "play-not-configured");
assert.equal((await verifyPlayEntitlement({ purchaseToken: "purchase-1", credentialsJson: "{\"client_email\":\"a@b.c\"}" })).reason, "play-not-configured");
const calls = [];
const active = await verifyPlayEntitlement({
  purchaseToken: "purchase-1",
  accessToken: "access-test",
  fetchImpl: async url => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: "maintenpro_premium_monthly", expiryTime: "2099-01-01T00:00:00Z" }] }) };
  }
});
assert.equal(active.ok, true);
assert.match(calls[0], /androidpublisher\.googleapis\.com\/androidpublisher\/v3\/applications\/com\.icapps\.maintenpro\/purchases\/subscriptionsv2\/tokens\//);
const expired = await verifyPlayEntitlement({
  purchaseToken: "purchase-1",
  accessToken: "access-test",
  fetchImpl: async () => ({ ok: true, json: async () => ({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", lineItems: [{ productId: "maintenpro_premium_monthly", expiryTime: "2099-01-01T00:00:00Z" }] }) })
});
assert.equal(expired.reason, "play-product-missing");
const otherProduct = await verifyPlayEntitlement({
  purchaseToken: "purchase-1",
  accessToken: "access-test",
  fetchImpl: async () => ({ ok: true, json: async () => ({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: "otro" }] }) })
});
assert.equal(otherProduct.reason, "play-product-missing");
const down = await verifyPlayEntitlement({
  purchaseToken: "purchase-1",
  accessToken: "access-test",
  fetchImpl: async () => { throw new Error("down"); }
});
assert.equal(down.reason, "play-unreachable");
const missingLibrary = await serviceAccountAccessToken({ client_email: "a@b.c", private_key: "unused" }, async () => {
  const error = new Error("missing");
  error.code = "ERR_MODULE_NOT_FOUND";
  throw error;
});
assert.equal(missingLibrary, "");

console.log("MaintenPro Google Play provider checks passed");
