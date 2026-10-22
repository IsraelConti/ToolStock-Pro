import assert from "node:assert/strict";
import { createApi } from "../server/create-api.js";
import { createMemoryStore } from "../server/store-memory.js";
import { applySyncResponse, buildSyncRequest } from "../src/sync-contract.js";

const PURCHASE = "purchase-sintetico";
const TOKEN = "token-sintetico";
const seen = [];
const store = createMemoryStore();
const api = createApi({
  store,
  clientId: "cliente-sintetico",
  verifyGoogle: async token => token === TOKEN ? { ok: true, sub: "google-ana", email: "ana@taller.example" } : { ok: false, reason: "invalid-token" },
  verifyPlay: async ({ purchaseToken }) => {
    seen.push(purchaseToken || "");
    return purchaseToken === PURCHASE ? { ok: true, active: true } : { ok: false, reason: "play-purchase-missing" };
  }
});

function client(deviceId) {
  return {
    deviceId,
    cursor: "",
    equipment: [],
    orders: [],
    plans: [],
    team: [],
    settings: { companyName: "", driveName: "No sale", updatedAt: "2026-10-01T00:00:00.000Z" }
  };
}

async function push(clientState) {
  const body = buildSyncRequest(clientState, { cursor: clientState.cursor, deviceId: clientState.deviceId });
  const result = await api.handle({ method: "POST", url: "/v1/sync", headers: { authorization: `Bearer ${TOKEN}` }, body });
  assert.equal(JSON.stringify(result.body).includes(PURCHASE), false);
  if (result.status !== 200) return result;
  const applied = applySyncResponse(clientState, result.body);
  assert.equal(applied.ok, true);
  clientState.equipment = applied.equipment;
  clientState.orders = applied.orders;
  clientState.plans = applied.plans;
  clientState.team = applied.team;
  clientState.settings = { ...applied.settings, driveName: clientState.settings.driveName };
  clientState.cursor = applied.cursor;
  return result;
}

const denied = await push(client("android-1"));
assert.equal(denied.status, 401);
assert.equal(denied.body.reason, "play-purchase-missing");
assert.equal((await store.load("google-ana")).revision, 0);

const session = await api.handle({ method: "POST", url: "/v1/session", headers: {}, body: { idToken: TOKEN, purchaseToken: PURCHASE } });
assert.equal(session.status, 200);
assert.equal(JSON.stringify(session.body).includes(PURCHASE), false);

const mobile = client("android-1");
mobile.equipment = [{ id: "eq-1", name: "Compresor movil", updatedAt: "2026-10-20T08:00:00.000Z" }];
mobile.settings = { companyName: "Taller Norte", driveName: "Carpeta movil", updatedAt: "2026-10-20T08:00:00.000Z" };
const mobileFirst = await push(mobile);
assert.equal(mobileFirst.status, 200);
assert.equal(mobile.cursor, "2");

const pc = client("pc-1");
pc.settings.driveName = "Carpeta pc";
const pcFirst = await push(pc);
assert.equal(pcFirst.status, 200);
assert.equal(pc.equipment.find(row => row.id === "eq-1").name, "Compresor movil");
assert.equal(pc.settings.companyName, "Taller Norte");
assert.equal(pc.settings.driveName, "Carpeta pc");

pc.orders = [{ id: "ot-9", description: "Fuga en PC", updatedAt: "2026-10-20T09:00:00.000Z" }];
assert.equal((await push(pc)).body.orders.map(row => row.id).join(","), "ot-9");
await push(mobile);
assert.equal(mobile.orders.find(row => row.id === "ot-9").description, "Fuga en PC");

mobile.equipment = mobile.equipment.map(row => row.id === "eq-1" ? { ...row, name: "Compresor antiguo", updatedAt: "2026-10-20T07:00:00.000Z" } : row);
pc.equipment = pc.equipment.map(row => row.id === "eq-1" ? { ...row, name: "Compresor revisado", updatedAt: "2026-10-20T10:00:00.000Z" } : row);
const lost = await push(mobile);
assert.ok(lost.body.conflicts.some(row => row.collection === "equipment" && row.id === "eq-1"));
await push(pc);
await push(mobile);
assert.equal(mobile.equipment.find(row => row.id === "eq-1").name, "Compresor revisado");
assert.equal(pc.equipment.find(row => row.id === "eq-1").name, "Compresor revisado");
assert.equal((await store.load("google-ana")).records.find(row => row.id === "eq-1").payload.name, "Compresor revisado");
assert.equal(seen[0], "");
assert.equal(seen.includes(PURCHASE), true);
console.log(`MaintenPro sync roundtrip OK: cursor ${mobile.cursor}, records ${(await store.load("google-ana")).records.length}`);
