/** Validar siempre el derecho firmado por servidor; nunca confiar en la hora del PC para crear una prueba. */
export function parseServerEntitlement(result, now = Date.now()) {
  const e = result?.entitlement;
  const expiresAt = typeof e?.expiresAt === "string" ? Date.parse(e.expiresAt) : NaN;
  const active = e?.active === true
    && e.serverValidated === true
    && e.productId === "maintenpro_premium_monthly"
    && (e.accessType === "premium" || e.accessType === "trial")
    && Number.isFinite(expiresAt) && expiresAt > now;
  return { active, expiresAt: active ? expiresAt : 0 };
}
