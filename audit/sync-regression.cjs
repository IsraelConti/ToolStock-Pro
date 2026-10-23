const assert = require("node:assert/strict");

(async () => {
  const { createDriveSync } = await import("../src/drive-sync.js");
  let writes = 0;
  let snapshot = {
    schemaVersion: 1,
    clientId: "client-a",
    updatedAt: "2026-10-23T09:00:00.000Z",
    data: {
      products: [{ id: "p-1", reference: "R-1", name: "Rodamiento", stock: 4, updatedAt: "2026-10-23T09:00:00.000Z" }],
      movements: [],
      employees: [],
      settings: { theme: "dark", updatedAt: "2026-10-23T09:00:00.000Z" }
    }
  };
  const sync = createDriveSync({
    getSnapshot: () => snapshot,
    setSnapshot: value => { snapshot = value; writes += 1; },
    getAccessToken: async () => "test-token"
  });

  const merged = sync.mergeSnapshots(snapshot, {
    schemaVersion: 1,
    clientId: "client-a",
    updatedAt: "2026-10-23T09:05:00.000Z",
    data: {
      products: [{ id: "p-2", reference: "R-2", name: "Junta", stock: 2, updatedAt: "2026-10-23T09:05:00.000Z" }],
      movements: [{ id: "m-1", delta: -1, createdAt: "2026-10-23T09:05:00.000Z" }],
      employees: [],
      settings: { theme: "light", updatedAt: "2026-10-23T09:05:00.000Z" }
    }
  });
  assert.equal(merged.data.products.length, 2);
  assert.equal(merged.data.movements.length, 1);
  assert.equal(merged.data.settings.theme, "light");
  assert.equal(merged.clientId, "client-a");

  const noToken = createDriveSync({ getSnapshot: () => snapshot, setSnapshot: () => {}, getAccessToken: async () => "" });
  await assert.rejects(noToken.sync(), /No se obtuvo un token/);
  assert.equal(writes, 0, "el test no debe escribir en Drive ni en el almacén local");
  console.log("PASS Drive merge preserves both devices, resolves newest records and rejects missing authorization");
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
