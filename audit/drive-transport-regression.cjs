const assert = require("node:assert/strict");

(async () => {
  const { driveFetch } = await import("../src/drive-http.js");
  const { createDriveSync } = await import("../src/drive-sync.js");
  const originalFetch = global.fetch;
  let browserCalls = 0;
  global.fetch = async () => { browserCalls++; return { ok: true, status: 200, text: async () => "{}" }; };
  await driveFetch("https://www.googleapis.com/drive/v3/files");
  assert.equal(browserCalls, 1, "PC continues to use browser fetch");
  global.fetch = () => { throw new Error("Android must not use blocked WebView fetch"); };
  const snapshots = new Map();
  const calls = [];
  global.ToolStockAndroid = {
    driveRequest(id, url, method, token, contentType, body) {
      calls.push({ url, method, token, contentType, body });
      assert.equal(token, "test-token");
      let result;
      if (method === "GET" && url.includes("alt=media")) result = snapshots.get("file-1");
      else if (method === "GET") result = { files: snapshots.has("file-1") ? [{ id: "file-1" }] : [] };
      else {
        const parts = body.split("\r\n\r\n");
        result = JSON.parse(parts[2].split("\r\n--")[0]);
        snapshots.set("file-1", result);
        result = { id: "file-1" };
      }
      queueMicrotask(() => global.onToolStockDriveResponse(id, JSON.stringify({ status: 200, body: JSON.stringify(result) })));
    }
  };
  const makeDevice = (id, products) => {
    let snapshot = { clientId: id, updatedAt: "2026-10-23T12:00:00.000Z", data: { products, movements: [], employees: [], settings: {} } };
    const sync = createDriveSync({ getSnapshot: () => snapshot, setSnapshot: value => { snapshot = value; }, getAccessToken: async () => "test-token" });
    return { sync, snapshot: () => snapshot };
  };
  const phone = makeDevice("phone", [{ id: "phone-part", name: "Piñón", stock: 5 }]);
  const pc = makeDevice("pc", [{ id: "pc-part", name: "Junta", stock: 2 }]);
  await phone.sync.sync();
  await pc.sync.sync();
  await phone.sync.sync();
  assert.equal(phone.snapshot().data.products.length, 2);
  assert.equal(pc.snapshot().data.products.length, 2);
  assert.ok(calls.some(call => call.method === "POST"), "first sync creates private file");
  assert.ok(calls.some(call => call.method === "PATCH"), "next device merges and updates it");
  assert.ok(calls.some(call => call.url.includes("alt=media")), "existing file is read");
  assert.ok(calls.filter(call => call.method !== "GET").every(call => call.contentType.startsWith("multipart/related; boundary=")));

  global.ToolStockAndroid.driveRequest = (id) => queueMicrotask(() => global.onToolStockDriveResponse(id, JSON.stringify({ status: 401, body: '{"error":{"message":"Expired authorization"}}' })));
  await assert.rejects(phone.sync.sync(), /Expired authorization/);
  global.ToolStockAndroid.driveRequest = (id) => queueMicrotask(() => global.onToolStockDriveResponse(id, JSON.stringify({ error: "Sin conexión" })));
  await assert.rejects(phone.sync.sync(), /Sin conexión/);
  global.ToolStockAndroid.driveRequest = (id) => queueMicrotask(() => global.onToolStockDriveResponse(id, "invalid json"));
  await assert.rejects(driveFetch("https://www.googleapis.com/drive/v3/files"), SyntaxError);
  global.ToolStockAndroid = {};
  await assert.rejects(driveFetch("https://www.googleapis.com/drive/v3/files"), /Actualiza ToolStock/);
  delete global.ToolStockAndroid;
  global.fetch = originalFetch;
  console.log("PASS Android native transport: create/read/update, two-device merge, HTTP/network errors; PC fetch preserved");
})().catch(error => { console.error(error); process.exitCode = 1; });
