import assert from "node:assert/strict";
import { applySyncResponse, buildSyncRequest, entitlementGrantsAccess, normalizeEndpoint, normalizeSyncConfig, readConflicts, readEntitlement, SYNC_CONTRACT } from "../src/sync-contract.js";

assert.equal(normalizeEndpoint(""), "");
assert.equal(normalizeEndpoint("ftp://archivos.example/sync"), "");
assert.equal(normalizeEndpoint("http://archivos.example/sync"), "");
assert.equal(normalizeEndpoint("https://usuario:clave@archivos.example/sync"), "");
assert.equal(normalizeEndpoint("https://archivos.example/sync/"), "https://archivos.example/sync");
assert.equal(normalizeEndpoint("http://127.0.0.1:8787/"), "http://127.0.0.1:8787");

const config = normalizeSyncConfig({ endpoint: "https://archivos.example/sync/", cursor: "c1" }, () => "device-1");
assert.equal(config.endpoint, "https://archivos.example/sync");
assert.equal(config.deviceId, "device-1");
const kept = normalizeSyncConfig({ ...config, endpoint: "no es una direccion" }, () => "otro");
assert.equal(kept.endpoint, "");
assert.equal(kept.deviceId, "device-1");
const storedEntitlement = normalizeSyncConfig({
  endpoint: "https://archivos.example/sync",
  deviceId: "device-1",
  entitlement: { active: true, serverValidated: true, productId: "maintenpro_premium_monthly", reason: "active" }
}, () => "otro");
assert.equal(storedEntitlement.entitlement, null);
assert.equal(storedEntitlement.pending, false);
const pending = normalizeSyncConfig({ pending: true, deviceId: "device-1", entitlement: { active: true, serverValidated: true, productId: "maintenpro_premium_monthly" } }, () => "otro");
assert.equal(pending.pending, true);
assert.equal(pending.entitlement, null);

const request = buildSyncRequest({
  equipment: [{ id: "eq-1", name: "Compresor" }],
  orders: [],
  plans: [],
  team: [],
  settings: { companyName: "Taller", driveName: "Carpeta local", ownerEmail: "ana@taller.example" }
}, config);
assert.equal(request.contract, SYNC_CONTRACT);
assert.equal(request.cursor, "c1");
assert.equal(request.settings.companyName, "Taller");
assert.equal("driveName" in request.settings, false);

const applied = applySyncResponse({
  equipment: [{ id: "eq-local", name: "Solo aquí", updatedAt: "2026-10-08T00:00:00.000Z" }],
  orders: [],
  plans: [],
  team: [],
  settings: { companyName: "Local", driveName: "Carpeta del móvil", updatedAt: "2026-10-01T00:00:00.000Z" }
}, {
  contract: SYNC_CONTRACT,
  cursor: "c2",
  equipment: [{ id: "eq-remote", name: "Del servicio", updatedAt: "2026-10-09T00:00:00.000Z" }],
  orders: [],
  plans: [],
  team: [],
  settings: { companyName: "Remoto", driveName: "No copiar", updatedAt: "2026-10-09T00:00:00.000Z" },
  entitlement: { active: true, productId: "maintenpro_premium_monthly", reason: "active" }
});
assert.equal(applied.ok, true);
assert.deepEqual(applied.equipment.map(row => row.id), ["eq-local", "eq-remote"]);
assert.equal(applied.settings.companyName, "Remoto");
assert.equal(applied.settings.driveName, "Carpeta del móvil");
assert.equal(applied.entitlement.active, false);
assert.equal(applied.accessGranted, false);
assert.equal(entitlementGrantsAccess(applied.entitlement), false);
const granted = readEntitlement({ active: true, serverValidated: true, productId: "maintenpro_premium_monthly", reason: "active" });
assert.equal(entitlementGrantsAccess(granted), true);
assert.deepEqual(readConflicts([{ collection: "equipment", id: "eq-1" }, { collection: "otro", id: "x" }, { collection: "orders", id: "" }]), [{ collection: "equipment", id: "eq-1" }]);
assert.equal(applySyncResponse({ equipment: [], orders: [], plans: [], team: [] }, { contract: "otro", cursor: "c2", equipment: [], orders: [], plans: [], team: [] }).ok, false);

console.log("MaintenPro sync contract OK");
