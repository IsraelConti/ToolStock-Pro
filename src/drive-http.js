const pending = new Map();
let sequence = 0;

// Android keeps file:// access locked down. Only Drive traffic uses its native bridge.
export async function driveFetch(url, options = {}) {
  const bridge = globalThis.ToolStockAndroid;
  if (!bridge) return globalThis.fetch(url, options);
  if (typeof bridge.driveRequest !== "function") {
    throw new Error("Actualiza ToolStock para conectar Android con Google Drive");
  }
  const headers = new Headers(options.headers || {});
  const authorization = headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const id = `drive-${Date.now()}-${++sequence}`;
  globalThis.onToolStockDriveResponse = (requestId, payload) => {
    const request = pending.get(requestId);
    if (!request) return;
    pending.delete(requestId);
    clearTimeout(request.timer);
    try {
      const result = JSON.parse(payload);
      if (result.error) throw new Error(result.error);
      if (!Number.isInteger(result.status) || result.status < 200 || result.status > 599 || typeof result.body !== "string") {
        throw new Error("Respuesta no válida de Google Drive");
      }
      request.resolve({ ok: result.status < 300, status: result.status, text: async () => result.body });
    } catch (error) { request.reject(error); }
  };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Google Drive no respondió a tiempo. Puedes volver a sincronizar."));
    }, 60000);
    pending.set(id, { resolve, reject, timer });
    try {
      bridge.driveRequest(id, String(url), options.method || "GET", token, headers.get("Content-Type") || "", options.body || "");
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    }
  });
}
