// Read-only connectivity probe. Never prints keys, access tokens or customer data.
const fs = require('node:fs');
const crypto = require('node:crypto');

async function main() {
  if (!process.argv[2]) throw new Error('Pass the local service-account JSON path.');
  const account = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (account.type !== 'service_account' || !account.client_email || !account.private_key) {
    throw new Error('Invalid service-account configuration.');
  }
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 300,
  });
  const assertion = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url');
  const auth = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(15000),
  });
  const token = await auth.json();
  if (!auth.ok || !token.access_token) {
    console.log('MAINTENPRO_PLAY_PREFLIGHT ' + JSON.stringify({ googleAuth: false, status: auth.status, error: token.error }));
    process.exitCode = 1;
    return;
  }
  const headers = { authorization: 'Bearer ' + token.access_token };
  const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.icapps.maintenpro';
  const productReply = await fetch(base + '/subscriptions/maintenpro_premium_monthly', {
    headers, signal: AbortSignal.timeout(15000),
  });
  const product = await productReply.json();
  // A deliberately invalid token checks rejection without reading any real order.
  const receiptReply = await fetch(base + '/purchases/subscriptionsv2/tokens/maintenpro-preflight-no-real-purchase-2026-10-22', {
    headers, signal: AbortSignal.timeout(15000),
  });
  const receipt = await receiptReply.json();
  const report = {
    googleAuth: true, subscriptionHttp: productReply.status,
    productId: product.productId,
    basePlans: product.basePlans?.map(item => ({ id: item.basePlanId, state: item.state })),
    subscriptionError: product.error?.status,
    receiptHttp: receiptReply.status,
    receiptError: receipt.error?.status,
    receiptReasons: receipt.error?.errors?.map(item => item.reason),
  };
  console.log('MAINTENPRO_PLAY_PREFLIGHT ' + JSON.stringify(report));
  if (!productReply.ok || ![400, 404, 410].includes(receiptReply.status)) process.exitCode = 1;
}
main().catch(() => { console.log('MAINTENPRO_PLAY_PREFLIGHT failed-network-or-configuration'); process.exitCode = 1; });
