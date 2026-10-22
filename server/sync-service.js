import { mergeRecords, mergeSettings } from "../src/sync-revisions.js";
import { SYNC_CONTRACT, SYNC_PRODUCT_ID } from "../src/sync-contract.js";

const COLLECTIONS = ["equipment", "orders", "plans", "team"];

function normalized(payload) {
  return mergeRecords(payload ? [payload] : [], [])[0] || null;
}

function changed(existing, incoming) {
  if (!existing) return true;
  const chosen = mergeRecords([existing], [incoming])[0];
  return JSON.stringify(chosen) !== JSON.stringify(normalized(existing));
}

export async function applyIncrementalSync(store, account, request) {
  const cursor = /^\d+$/.test(String(request?.cursor || "")) ? Number(request.cursor) : 0;
  const state = await store.load(account.sub);
  let revision = state.revision;
  const records = state.records.map(row => ({ ...row, payload: { ...row.payload } }));
  for (const collection of COLLECTIONS) {
    for (const incoming of Array.isArray(request?.[collection]) ? request[collection] : []) {
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) continue;
      const index = records.findIndex(row => row.collection === collection && row.id === incoming.id);
      const existing = index >= 0 ? records[index].payload : null;
      if (!changed(existing, incoming)) continue;
      const winner = mergeRecords(existing ? [existing] : [], [incoming])[0];
      revision += 1;
      const stored = { collection, id: winner.id, payload: winner, revision };
      if (index >= 0) records[index] = stored;
      else records.push(stored);
    }
  }
  let settings = { ...state.settings };
  let settingsRevision = state.settingsRevision;
  const mergedSettings = mergeSettings(settings, request?.settings);
  delete mergedSettings.driveName;
  if (JSON.stringify(mergedSettings) !== JSON.stringify(settings)) {
    revision += 1;
    settings = mergedSettings;
    settingsRevision = revision;
  }
  await store.save(account.sub, { revision, records, settings, settingsRevision });
  const delta = records.filter(row => row.revision > cursor);
  const echoed = [];
  for (const collection of COLLECTIONS) {
    for (const incoming of Array.isArray(request?.[collection]) ? request[collection] : []) {
      const stored = records.find(row => row.collection === collection && row.id === incoming.id);
      if (!stored || delta.some(row => row.collection === collection && row.id === stored.id)) continue;
      const incomingNorm = mergeRecords([], [incoming])[0];
      if (JSON.stringify(stored.payload) !== JSON.stringify(incomingNorm)) echoed.push(stored);
    }
  }
  const body = { contract: SYNC_CONTRACT, cursor: String(revision), deviceId: typeof request?.deviceId === "string" ? request.deviceId : "", equipment: [], orders: [], plans: [], team: [], settings, conflicts: echoed.map(row => ({ collection: row.collection, id: row.id })), entitlement: { active: true, serverValidated: true, productId: SYNC_PRODUCT_ID, reason: "active" } };
  for (const row of [...delta, ...echoed]) body[row.collection].push(row.payload);
  return body;
}
