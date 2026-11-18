import test from "node:test";
import assert from "node:assert/strict";
import { parseServerEntitlement } from "./license-entitlement.mjs";

const now = Date.parse("2026-11-18T09:00:00.000Z");
const entitlement = (accessType, expiresAt, changes = {}) => ({ entitlement: {
  active:true, serverValidated:true, productId:"maintenpro_premium_monthly",
  accessType, expiresAt, ...changes
}});

test("Drive Windows: trial de 7 días avalado por servidor", () => {
  const data = parseServerEntitlement(entitlement("trial","2026-11-25T09:00:00.000Z"),now);
  assert.equal(data.active,true);
  assert.ok(data.expiresAt > now);
});
test("Drive Windows: Premium válido, restaurado desde backend", () => {
  assert.equal(parseServerEntitlement(entitlement("premium","2026-12-18T09:00:00.000Z"),now).active,true);
});
test("Drive Windows: caduca exactamente en la fecha del servidor", () => {
  assert.equal(parseServerEntitlement(entitlement("trial","2026-11-18T09:00:00.000Z"),now).active,false);
  assert.equal(parseServerEntitlement(entitlement("trial","2026-11-17T09:00:00.000Z"),now).active,false);
});
test("Drive Windows: rechaza derecho local, expiración corrupta y producto distinto", () => {
  assert.equal(parseServerEntitlement(entitlement("trial","2026-12-18T09:00:00.000Z",{serverValidated:false}),now).active,false);
  assert.equal(parseServerEntitlement(entitlement("trial","invalid"),now).active,false);
  assert.equal(parseServerEntitlement(entitlement("trial","2026-12-18T09:00:00.000Z",{productId:"other"}),now).active,false);
  assert.equal(parseServerEntitlement(entitlement("other","2026-12-18T09:00:00.000Z"),now).active,false);
});
test("Drive Windows: rechaza respuesta vacía y ausencia de cuenta", () => {
  assert.equal(parseServerEntitlement(null,now).active,false);
  assert.equal(parseServerEntitlement({},now).active,false);
});
