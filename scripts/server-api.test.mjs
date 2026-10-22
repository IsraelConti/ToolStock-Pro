import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApi } from "../server/create-api.js";
import { createMemoryStore } from "../server/store-memory.js";

const schema = await readFile(new URL("../server/migrations/001_init.sql", import.meta.url), "utf8");
for (const table of ["accounts", "records", "account_settings", "account_play"]) assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
const pgSource = await readFile(new URL("../server/store-pg.js", import.meta.url), "utf8");
assert.match(pgSource, /INSERT INTO records/);
assert.match(pgSource, /account_settings/);
assert.match(pgSource, /INSERT INTO account_play/);

const googleAna = async token => token === "token-ana" ? { ok: true, sub: "google-ana", email: "ana@taller.example" } : { ok: false, reason: "invalid-token" };
const playMissing = async () => ({ ok: false, reason: "play-product-missing" });
const playActive = async () => ({ ok: true, active: true });

function api(store, verifyPlay) {
  return createApi({ store, verifyGoogle: googleAna, verifyPlay, clientId: "test-client" });
}

const record = (id, name, updatedAt) => ({ id, name, updatedAt });
const syncBody = (cursor, equipment) => ({ contract: "maintenpro.sync.v1", cursor, deviceId: "pc-1", equipment, orders: [], plans: [], team: [], settings: {} });

const deniedStore = createMemoryStore();
const denied = api(deniedStore, playMissing);
assert.deepEqual(await denied.handle({ method: "GET", url: "/v1/health", headers: {} }), { status: 200, body: { ok: true } });
const missingToken = await denied.handle({ method: "POST", url: "/v1/sync", headers: {}, body: syncBody("", [record("eq-1", "Local", "2026-10-02T00:00:00.000Z")]) });
assert.equal(missingToken.status, 401);
assert.equal(missingToken.body.reason, "missing-token");
const badToken = await denied.handle({ method: "POST", url: "/v1/sync", headers: { authorization: "Bearer otro" }, body: syncBody("", []) });
assert.equal(badToken.status, 401);
assert.equal(badToken.body.reason, "invalid-token");
const noProduct = await denied.handle({ method: "POST", url: "/v1/sync", headers: { authorization: "Bearer token-ana" }, body: syncBody("", [record("eq-1", "Local", "2026-10-02T00:00:00.000Z")]) });
assert.equal(noProduct.status, 401);
assert.equal(noProduct.body.error, "unauthorized");
assert.equal(noProduct.body.reason, "play-product-missing");
assert.equal((await deniedStore.load("google-ana")).revision, 0);
const noEntitlement = await denied.handle({ method: "GET", url: "/v1/entitlement", headers: { authorization: "Bearer token-ana" } });
assert.equal(noEntitlement.status, 401);

const store = createMemoryStore();
const allowed = api(store, playActive);
const first = await allowed.handle({ method: "POST", url: "/v1/sync", headers: { authorization: "Bearer token-ana" }, body: syncBody("", [record("eq-1", "Compresor", "2026-10-02T00:00:00.000Z")]) });
assert.equal(first.status, 200);
assert.equal(first.body.cursor, "1");
assert.equal(first.body.equipment.length, 1);
assert.equal(first.body.entitlement.serverValidated, true);
assert.equal(first.body.entitlement.active, true);
const second = await allowed.handle({ method: "POST", url: "/v1/sync", headers: { authorization: "Bearer token-ana" }, body: syncBody(first.body.cursor, [record("eq-1", "Compresor", "2026-10-02T00:00:00.000Z"), record("eq-2", "Bomba", "2026-10-03T00:00:00.000Z")]) });
assert.equal(second.status, 200);
assert.deepEqual(second.body.equipment.map(row => row.id), ["eq-2"]);
const stale = await allowed.handle({ method: "POST", url: "/v1/sync", headers: { authorization: "Bearer token-ana" }, body: syncBody(second.body.cursor, [record("eq-2", "Bomba antigua", "2026-10-01T00:00:00.000Z")]) });
assert.equal(stale.body.equipment[0].name, "Bomba");
assert.deepEqual(stale.body.conflicts, [{ collection: "equipment", id: "eq-2" }]);
assert.equal((await store.load("google-ana")).records.find(row => row.id === "eq-2").payload.name, "Bomba");
const revisionBeforeInvalid = (await store.load("google-ana")).revision;
const missingDevice = await allowed.handle({ method: "POST", url: "/v1/sync", headers: { authorization: "Bearer token-ana" }, body: { contract: "maintenpro.sync.v1", cursor: "", equipment: [{ id: "eq-9", name: "No guardar", updatedAt: "2026-10-09T00:00:00.000Z" }], orders: [], plans: [], team: [], settings: {} } });
assert.equal(missingDevice.status, 400);
assert.equal(missingDevice.body.error, "invalid-device");
assert.equal((await store.load("google-ana")).revision, revisionBeforeInvalid);
assert.equal((await store.load("google-ana")).records.some(row => row.id === "eq-9"), false);

const purchase = "purchase-token-ana";
const sessionStore = createMemoryStore();
let seenPurchase = "";
const sessionApi = createApi({
  store: sessionStore,
  verifyGoogle: googleAna,
  verifyPlay: async ({ purchaseToken }) => {
    seenPurchase = purchaseToken || "";
    return purchaseToken === purchase ? { ok: true, active: true } : { ok: false, reason: "play-purchase-missing" };
  },
  clientId: "test-client"
});
const blocked = await sessionApi.handle({ method: "POST", url: "/v1/sync", headers: { authorization: "Bearer token-ana" }, body: syncBody("", []) });
assert.equal(blocked.status, 401);
assert.equal(blocked.body.reason, "play-purchase-missing");
const opened = await sessionApi.handle({ method: "POST", url: "/v1/session", headers: {}, body: { idToken: "token-ana", purchaseToken: purchase } });
assert.equal(opened.status, 200);
assert.equal(JSON.stringify(opened.body).includes(purchase), false);
const linked = await sessionApi.handle({ method: "POST", url: "/v1/sync", headers: { authorization: "Bearer token-ana" }, body: syncBody("", []) });
assert.equal(linked.status, 200);
assert.equal(seenPurchase, purchase);

console.log("MaintenPro server API OK");
