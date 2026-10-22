import { createHash, randomBytes } from "node:crypto";

export function createPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function authorizationUrl({ clientId, redirectUri, challenge, state, scope = "openid email https://www.googleapis.com/auth/drive.appdata" }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAuthorizationCode({ clientId, clientSecret = "", code, verifier, redirectUri, fetchImpl, tokenUrl = "https://oauth2.googleapis.com/token" }) {
  const fields = { client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: "authorization_code" };
  if (clientSecret) fields.client_secret = clientSecret;
  const response = await fetchImpl(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(fields), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) return { idToken: "" };
  const body = await response.json();
  return { idToken: body.id_token || "", accessToken: body.access_token || "", refreshToken: body.refresh_token || "", expiresIn: Number(body.expires_in) || 3600, scope: body.scope || "" };
}
