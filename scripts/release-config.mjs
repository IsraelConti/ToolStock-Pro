import { readFile } from 'node:fs/promises';
export async function releaseConfig() {
  return JSON.parse(await readFile(new URL('../config/release.json', import.meta.url), 'utf8'));
}
export function releaseProblems(c) {
  const errors = [];
  for (const key of ['googleWebClientId', 'desktopClientId']) if (!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(c[key] || '')) errors.push(`${key}: falta el cliente OAuth de Google`);
  for (const key of ['entitlementBase', 'pcDownloadUrl']) {
    try { const u = new URL(c[key]); if (u.protocol !== 'https:' || u.username || u.password) throw Error(); }
    catch { errors.push(`${key}: falta la dirección HTTPS publicada`); }
  }
  if (c.packageName !== 'com.icapps.maintenpro' || c.playProductId !== 'maintenpro_premium_monthly') errors.push('Identidad de la aplicación o del producto incorrecta');
  if (!(c.versionCode > 11)) errors.push('El versionCode debe superar el último candidato (11)');
  return errors;
}
if (process.argv.includes('--check')) {
  const errors = releaseProblems(await releaseConfig());
  if (errors.length) { console.error('Publicación bloqueada:\n' + errors.map(e => `- ${e}`).join('\n')); process.exitCode = 1; }
  else console.log('Configuración pública de la actualización completa. Aún requiere las pruebas reales de Google y Play.');
}
