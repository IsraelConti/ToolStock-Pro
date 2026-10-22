import assert from "node:assert/strict";
import { mergeBackup, mergeRecords, mergeSettings, visibleRecords } from "../src/sync-revisions.js";

const localOnly = { id: "local-1", name: "Compresor local", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };
const sharedOlder = { id: "shared", name: "Versión local", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z" };
const sharedNewer = { id: "shared", name: "Versión de la copia", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-03T00:00:00.000Z" };
const incomingOnly = { id: "copy-1", name: "Bomba de la copia", createdAt: "2026-10-04T00:00:00.000Z", updatedAt: "2026-10-04T00:00:00.000Z" };

const merged = mergeRecords([localOnly, sharedOlder], [sharedNewer, incomingOnly]);
assert.deepEqual(merged.map(row => row.id), ["local-1", "shared", "copy-1"]);
assert.equal(merged.find(row => row.id === "local-1").name, "Compresor local");
assert.equal(merged.find(row => row.id === "shared").name, "Versión de la copia");

const tie = mergeRecords(
  [{ id: "shared", name: "Local", updatedAt: "2026-10-02T00:00:00.000Z" }],
  [{ id: "shared", name: "Copia", updatedAt: "2026-10-02T00:00:00.000Z" }]
);
assert.equal(tie[0].name, "Local");

const deletion = mergeRecords(
  [{ id: "plan-1", title: "Engrase", updatedAt: "2026-10-02T00:00:00.000Z" }],
  [{ id: "plan-1", title: "Engrase", updatedAt: "2026-10-05T00:00:00.000Z", deletedAt: "2026-10-05T00:00:00.000Z" }]
);
assert.equal(visibleRecords(deletion).length, 0);
assert.equal(deletion.length, 1);

const keptAfterOldDeletion = mergeRecords(
  [{ id: "plan-1", title: "Engrase nuevo", updatedAt: "2026-10-06T00:00:00.000Z" }],
  [{ id: "plan-1", title: "Engrase", updatedAt: "2026-10-05T00:00:00.000Z", deletedAt: "2026-10-05T00:00:00.000Z" }]
);
assert.equal(visibleRecords(keptAfterOldDeletion)[0].title, "Engrase nuevo");

const legacy = mergeRecords(
  [{ id: "eq-1", name: "Editado aquí", createdAt: "2026-10-01T00:00:00.000Z" }],
  [{ id: "eq-1", name: "Copia antigua", createdAt: "2026-10-01T00:00:00.000Z" }]
);
assert.equal(legacy[0].name, "Editado aquí");
assert.equal(legacy[0].updatedAt, "2026-10-01T00:00:00.000Z");

const backup = {
  version: 2,
  exportedAt: "2026-10-20T00:00:00.000Z",
  equipment: [sharedNewer, incomingOnly],
  orders: [],
  plans: [],
  team: [],
  settings: { companyName: "Taller Norte", ownerEmail: "ana@taller.example", driveName: "No copiar" }
};
const state = mergeBackup(
  { equipment: [localOnly, sharedOlder], orders: [{ id: "order-local", description: "Solo aquí", updatedAt: "2026-10-08T00:00:00.000Z" }], plans: [], team: [], settings: { companyName: "", ownerEmail: "local@taller.example", driveName: "Carpeta del móvil", tax: 21 } },
  backup
);
assert.equal(state.ok, true);
assert.equal(state.equipment.length, 3);
assert.equal(state.orders[0].id, "order-local");
assert.equal(state.settings.ownerEmail, "local@taller.example");
assert.equal(state.settings.companyName, "Taller Norte");
assert.equal(state.settings.driveName, "Carpeta del móvil");
assert.equal(state.settings.tax, 21);

const repeated = mergeBackup(state, backup);
assert.equal(repeated.equipment.length, state.equipment.length);
assert.deepEqual(repeated.equipment.map(row => row.id), state.equipment.map(row => row.id));

const newerSettings = mergeSettings(
  { companyName: "Local", ownerEmail: "local@taller.example", driveName: "Local", updatedAt: "2026-10-01T00:00:00.000Z", tax: 10 },
  { companyName: "Remoto", ownerEmail: "remoto@taller.example", driveName: "Remoto", updatedAt: "2026-10-09T00:00:00.000Z", tax: 4 }
);
assert.equal(newerSettings.companyName, "Remoto");
assert.equal(newerSettings.tax, 4);
assert.equal(newerSettings.driveName, "Local");

assert.equal(mergeBackup({ equipment: [], orders: [], plans: [], team: [] }, { version: 1, equipment: [], orders: [], plans: [], team: [] }).ok, false);
assert.equal(mergeBackup({ equipment: [], orders: [], plans: [], team: [] }, { version: 2, equipment: {}, orders: [], plans: [], team: [] }).ok, false);

console.log("MaintenPro sync revisions OK");
