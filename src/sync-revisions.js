const SETTINGS_KEYS = ["appName", "companyName", "ownerEmail", "language", "currency", "tax", "alertDays", "urgentDays", "notifications"];
const EMPTY_REVISION = "1970-01-01T00:00:00.000Z";

export function isIso(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value);
}

export function visibleRecords(rows) {
  return (Array.isArray(rows) ? rows : []).filter(row => row && typeof row === "object" && !Array.isArray(row) && !isIso(row.deletedAt));
}

function revisionOf(record) {
  if (isIso(record.deletedAt)) return record.deletedAt;
  if (isIso(record.updatedAt)) return record.updatedAt;
  if (isIso(record.createdAt)) return record.createdAt;
  return EMPTY_REVISION;
}

function compareRevision(left, right) {
  const leftTime = Date.parse(revisionOf(left));
  const rightTime = Date.parse(revisionOf(right));
  if (leftTime === rightTime) return 0;
  return leftTime > rightTime ? 1 : -1;
}

function cleanId(value, allocateId) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : allocateId();
}

function normalizeRecord(row, allocateId) {
  const copy = { ...row, id: cleanId(row.id, allocateId) };
  if (!isIso(copy.deletedAt)) delete copy.deletedAt;
  if (!isIso(copy.updatedAt)) copy.updatedAt = isIso(copy.createdAt) ? copy.createdAt : EMPTY_REVISION;
  return copy;
}

function addRecords(merged, rows, idPrefix) {
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    const record = normalizeRecord(row, () => `${idPrefix}-${index}`);
    const current = merged.get(record.id);
    if (!current || compareRevision(record, current) > 0) merged.set(record.id, record);
  });
}

export function mergeRecords(localRows, incomingRows) {
  const merged = new Map();
  addRecords(merged, Array.isArray(localRows) ? localRows : [], "import-local");
  addRecords(merged, Array.isArray(incomingRows) ? incomingRows : [], "import-copy");
  return [...merged.values()];
}

function blankSetting(key, value) {
  return value == null || value === "" || (key === "appName" && value === "MaintenPro");
}

export function mergeSettings(localSettings, incomingSettings) {
  const local = localSettings && typeof localSettings === "object" && !Array.isArray(localSettings) ? { ...localSettings } : {};
  const incoming = incomingSettings && typeof incomingSettings === "object" && !Array.isArray(incomingSettings) ? incomingSettings : null;
  if (!incoming) return local;
  const localStamp = isIso(local.updatedAt) ? local.updatedAt : "";
  const incomingStamp = isIso(incoming.updatedAt) ? incoming.updatedAt : "";
  const incomingNewer = localStamp && incomingStamp ? incomingStamp > localStamp : !localStamp && !!incomingStamp;
  const merged = { ...local };
  for (const key of SETTINGS_KEYS) {
    if (!(key in incoming)) continue;
    if (incomingNewer || blankSetting(key, local[key])) merged[key] = incoming[key];
  }
  if (incomingNewer) merged.updatedAt = incomingStamp;
  merged.driveName = local.driveName || "";
  return merged;
}

function validRows(value) {
  return Array.isArray(value) && value.every(row => row && typeof row === "object" && !Array.isArray(row));
}

export function mergeBackup(localState, backup) {
  if (!backup || backup.version !== 2 || !validRows(backup.equipment) || !validRows(backup.orders) || !validRows(backup.plans) || !validRows(backup.team)) {
    return { ok: false };
  }
  const local = localState && typeof localState === "object" ? localState : {};
  return {
    ok: true,
    equipment: mergeRecords(local.equipment, backup.equipment),
    orders: mergeRecords(local.orders, backup.orders),
    plans: mergeRecords(local.plans, backup.plans),
    team: mergeRecords(local.team, backup.team),
    settings: mergeSettings(local.settings, backup.settings)
  };
}
