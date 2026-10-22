import assert from "node:assert/strict";
import { applySyncResponse, buildSyncRequest, describeSyncState, noteSyncFailure, noteSyncSuccess } from "../src/sync-contract.js";

const local = {
  equipment: [{ id: "eq-1", name: "Compresor local", updatedAt: "2026-10-20T08:00:00.000Z" }],
  orders: [],
  plans: [],
  team: [],
  settings: { companyName: "Taller", updatedAt: "2026-10-20T08:00:00.000Z" }
};
let config = { endpoint: "", deviceId: "android-1", cursor: "", pending: false, failure: "", entitlement: null };
const secret = "valor-que-no-puede-salir";

assert.equal(describeSyncState({}).text.startsWith("Sin configurar."), true);
config = noteSyncFailure(config, "unconfigured");
assert.equal(config.pending, true);
assert.equal(describeSyncState({ pending: true, failure: config.failure }).text.startsWith("Sin configurar."), true);
assert.deepEqual(local.equipment.map(row => row.name), ["Compresor local"]);

config = { ...config, endpoint: "https://sync.example" };
config = noteSyncFailure(config, "offline");
assert.equal(describeSyncState({ endpoint: config.endpoint, pending: true, failure: "offline" }).text.startsWith("Sin conexión."), true);
const queued = buildSyncRequest(local, config);
assert.equal(queued.equipment[0].name, "Compresor local");
assert.equal(JSON.stringify(queued).includes(secret), false);

const retry = buildSyncRequest(local, noteSyncFailure(config, "offline"));
assert.equal(retry.equipment[0].id, queued.equipment[0].id);
assert.equal(retry.cursor, "");

const applied = applySyncResponse(local, {
  contract: "maintenpro.sync.v1",
  cursor: "3",
  equipment: [{ id: "eq-1", name: "Compresor del servicio", updatedAt: "2026-10-20T10:00:00.000Z" }],
  orders: [],
  plans: [],
  team: [],
  settings: local.settings,
  conflicts: [{ collection: "equipment", id: "eq-1" }],
  entitlement: { active: true, serverValidated: true, productId: "maintenpro_premium_monthly", reason: "active" }
});
assert.equal(applied.ok, true);
assert.equal(applied.conflicts.length, 1);
assert.equal(applied.equipment[0].name, "Compresor del servicio");
config = noteSyncSuccess(config, applied.cursor);
config = { ...config, entitlement: applied.entitlement };
assert.equal(config.pending, false);
assert.equal(config.failure, "");
assert.equal(config.cursor, "3");
assert.equal(describeSyncState({ entitlementActive: true }).text, "Compra confirmada por el servicio.");
assert.equal(JSON.stringify(config).includes(secret), false);
console.log("MaintenPro sync queue OK");
