import { mergeBackup } from "./sync-revisions.js";

export const SYNC_CONTRACT = "maintenpro.sync.v1";
export const SYNC_PRODUCT_ID = "maintenpro_premium_monthly";
const SETTINGS_KEYS = ["appName", "companyName", "ownerEmail", "language", "currency", "tax", "alertDays", "urgentDays", "notifications", "updatedAt"];

export function normalizeEndpoint(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  let url;
  try { url = new URL(text); } catch { return ""; }
  if (url.username || url.password || url.search || url.hash) return "";
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return "";
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

export function normalizeSyncConfig(value, createDeviceId) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const deviceId = typeof source.deviceId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(source.deviceId) ? source.deviceId : createDeviceId();
  return {
    endpoint: normalizeEndpoint(source.endpoint),
    deviceId,
    cursor: typeof source.cursor === "string" ? source.cursor : "",
    pending: source.pending === true,
    failure: syncFailure(source.failure),
    entitlement: null
  };
}

const SYNC_FAILURES = new Set(["offline", "unauthorized", "unconfigured", "invalid"]);

function syncFailure(value) {
  return SYNC_FAILURES.has(value) ? value : "";
}

export function describeSyncState({ endpoint = "", transport = false, pending = false, failure = "", entitlementActive = false } = {}) {
  if (entitlementActive) return { state: "ready", text: "Compra confirmada por el servicio." };
  if (pending && failure === "offline") return { state: "offline", text: "Sin conexión. El último intento no se envió. Los datos siguen solo en este dispositivo." };
  if (pending) return { state: "pending", text: "Sin configurar. El último intento no se envió. Los datos siguen solo en este dispositivo." };
  if (!transport && !endpoint) return { state: "unconfigured", text: "Sin configurar. La sincronización está apagada y no se envía ningún dato." };
  if (!transport) return { state: "unconfigured", text: "Sin configurar. La dirección está guardada, pero falta la sesión. No se envía ningún dato." };
  return { state: "closed", text: "Sin configurar la compra. Inicia sesión con Google. El servicio abre el acceso solo si confirma la compra." };
}

export function noteSyncFailure(config, failure) {
  return { ...config, pending: true, failure: syncFailure(failure) || "unconfigured", entitlement: null };
}

export function noteSyncSuccess(config, cursor) {
  return { ...config, pending: false, failure: "", entitlement: null, cursor: typeof cursor === "string" ? cursor : config?.cursor || "" };
}

function sharedSettings(settings) {
  const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  const copy = {};
  for (const key of SETTINGS_KEYS) if (key in source) copy[key] = source[key];
  return copy;
}

export function buildSyncRequest(state, config) {
  const source = state && typeof state === "object" ? state : {};
  return {
    contract: SYNC_CONTRACT,
    cursor: typeof config?.cursor === "string" ? config.cursor : "",
    deviceId: config?.deviceId || "",
    equipment: Array.isArray(source.equipment) ? source.equipment : [],
    orders: Array.isArray(source.orders) ? source.orders : [],
    plans: Array.isArray(source.plans) ? source.plans : [],
    team: Array.isArray(source.team) ? source.team : [],
    settings: sharedSettings(source.settings)
  };
}

export function readEntitlement(value) {
  const serverValidated = value?.serverValidated === true;
  const active = serverValidated && value?.active === true && value?.productId === SYNC_PRODUCT_ID;
  return {
    active,
    serverValidated,
    productId: SYNC_PRODUCT_ID,
    reason: typeof value?.reason === "string" ? value.reason : (active ? "active" : "play-product-missing")
  };
}

export function entitlementGrantsAccess(entitlement) {
  return entitlement?.serverValidated === true && entitlement?.active === true && entitlement?.productId === SYNC_PRODUCT_ID;
}

const CONFLICT_COLLECTIONS = new Set(["equipment", "orders", "plans", "team"]);

export function readConflicts(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(row => row && CONFLICT_COLLECTIONS.has(row.collection) && typeof row.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(row.id)).map(row => ({ collection: row.collection, id: row.id }));
}

export function applySyncResponse(localState, response) {
  if (!response || response.contract !== SYNC_CONTRACT || typeof response.cursor !== "string") return { ok: false };
  const merged = mergeBackup(localState, {
    version: 2,
    equipment: response.equipment,
    orders: response.orders,
    plans: response.plans,
    team: response.team,
    settings: response.settings
  });
  if (!merged.ok) return { ok: false };
  const entitlement = readEntitlement(response.entitlement);
  return { ...merged, cursor: response.cursor, entitlement, accessGranted: entitlementGrantsAccess(entitlement), conflicts: readConflicts(response.conflicts) };
}
