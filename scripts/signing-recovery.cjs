const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const FORMAT = 'maintenpro-signing-backup/v1';
const aad = Buffer.from(FORMAT);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function encryptPayload(payload, publicKey) {
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const pub = crypto.createPublicKey(publicKey);
  return {
    format: FORMAT, algorithm: 'RSA-OAEP-SHA256+A256GCM',
    publicKeyFingerprint: hash(pub.export({ type: 'spki', format: 'der' })),
    encryptedKey: crypto.publicEncrypt({ key: pub, oaepHash: 'sha256' }, key).toString('base64'),
    iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}
function decryptEnvelope(envelope, privateKey) {
  if (envelope.format !== FORMAT || envelope.algorithm !== 'RSA-OAEP-SHA256+A256GCM') throw Error('Invalid recovery format.');
  const key = crypto.privateDecrypt({ key: privateKey, oaepHash: 'sha256' }, Buffer.from(envelope.encryptedKey, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
  if (payload.packageName !== 'com.icapps.maintenpro' || !payload.storePassword || !payload.keyPassword) throw Error('Incomplete recovery payload.');
  const bytes = Buffer.from(payload.keystoreBase64, 'base64');
  if (!bytes.length || hash(bytes) !== payload.keystoreSha256) throw Error('Keystore recovery checksum mismatch.');
  return payload;
}
function main() {
  const [mode, keyPath, filePath, outDir] = process.argv.slice(2);
  if (!['encrypt', 'verify', 'recover'].includes(mode) || !keyPath || !filePath) throw Error('Usage: signing-recovery.cjs encrypt PUBLIC_KEY OUTPUT | verify PRIVATE_KEY ENVELOPE | recover PRIVATE_KEY ENVELOPE OUTPUT_DIRECTORY');
  if (mode === 'encrypt') {
    for (const name of ['KEYSTORE_B64', 'STORE_PASSWORD', 'KEY_PASSWORD']) if (!process.env[name]) throw Error('Missing signing configuration.');
    const bytes = Buffer.from(process.env.KEYSTORE_B64, 'base64');
    if (!bytes.length) throw Error('Empty signing keystore.');
    const payload = {
      packageName: 'com.icapps.maintenpro', createdAt: new Date().toISOString(),
      keystoreBase64: bytes.toString('base64'), keystoreSha256: hash(bytes),
      storePassword: process.env.STORE_PASSWORD, keyPassword: process.env.KEY_PASSWORD,
      configuredAlias: process.env.KEY_ALIAS || '',
    };
    const envelope = encryptPayload(payload, fs.readFileSync(keyPath, 'utf8'));
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log('Created encrypted MaintenPro signing backup. No keys or passwords are written to the log.');
    return;
  }
  const payload = decryptEnvelope(JSON.parse(fs.readFileSync(filePath, 'utf8')), fs.readFileSync(keyPath, 'utf8'));
  if (mode === 'verify') {
    console.log(JSON.stringify({ restorable: true, packageName: payload.packageName, keystoreBytes: Buffer.from(payload.keystoreBase64, 'base64').length, keystoreChecksumMatches: true, storePasswordPresent: true, keyPasswordPresent: true, configuredAliasPresent: Boolean(payload.configuredAlias) }));
    return;
  }
  if (!outDir) throw Error('Choose a private recovery output directory.');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'maintenpro-upload.jks'), Buffer.from(payload.keystoreBase64, 'base64'), { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(path.join(outDir, 'signing-passwords.json'), JSON.stringify({ storePassword: payload.storePassword, keyPassword: payload.keyPassword, configuredAlias: payload.configuredAlias }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('Recovered the signing files in the requested directory.');
}
module.exports = { encryptPayload, decryptEnvelope };
if (require.main === module) {
  try { main(); } catch { console.error('Signing backup operation failed. No private data was logged.'); process.exitCode = 1; }
}
