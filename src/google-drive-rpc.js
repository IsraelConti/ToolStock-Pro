import { cleanState, DRIVE_SCHEMA, validId } from "./drive-state.js";

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const MAX_BYTES = 20 * 1024 * 1024;
const fileIdPattern = /^[A-Za-z0-9_-]{1,200}$/;
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export function createGoogleDriveRpc({ getAccessToken, getSession, ensureEntitlement, fetchImpl = globalThis.fetch }) {
  async function request(url, options = {}) {
    const token = await getAccessToken();
    if (!token) throw new Error("authorization-required");
    const response = await fetchImpl(url, { ...options, headers: { accept: "application/json", ...options.headers, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    if (response.status === 401 || response.status === 403) {
      let reason = "";
      try { reason = (await response.json()).error?.errors?.[0]?.reason || ""; } catch { /* no credential or response text is logged */ }
      throw new Error(/quota|rateLimit|storageQuota/i.test(reason) ? "quota-exceeded" : "authorization-required");
    }
    if (response.status === 429) throw new Error("quota-exceeded");
    if (!response.ok) throw new Error(response.status === 404 ? "drive-file-missing" : "drive-unreachable");
    if (Number(response.headers?.get?.("content-length") || 0) > MAX_BYTES) throw new Error("payload-too-large");
    const raw = await response.text();
    if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error("payload-too-large");
    try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error("invalid-response"); }
  }
  const safeFileId = value => { if (!fileIdPattern.test(String(value || ""))) throw new Error("invalid-file"); return value; };
  return async payload => {
    if (!payload || typeof payload !== "object") throw new Error("invalid-request");
    if (payload.op === "status") return getSession();
    if (!["list", "read", "write"].includes(payload.op)) throw new Error("invalid-operation");
    const session = await getSession();
    if (!session.configured) throw new Error("configuration-missing");
    if (!session.connected || !session.accountId) throw new Error("sign-in-required");
    if (!(await ensureEntitlement())) throw new Error("purchase-required");
    if (payload.op === "list") {
      let pageToken = "";
      const files = [];
      const tokens = new Set();
      do {
        const q = "trashed = false and appProperties has { key='schema' and value='maintenpro.drive.v1' }";
        const params = new URLSearchParams({ spaces: "appDataFolder", q, fields: "nextPageToken,files(id,appProperties)", pageSize: "100" });
        if (pageToken) params.set("pageToken", pageToken);
        const result = await request(`${API}?${params}`);
        if (!Array.isArray(result.files)) throw new Error("invalid-response");
        for (const file of result.files) {
          if (!fileIdPattern.test(file.id) || !validId(file.appProperties?.deviceId)) throw new Error("invalid-response");
          files.push({ id: file.id, deviceId: file.appProperties.deviceId });
        }
        pageToken = result.nextPageToken || "";
        if (files.length > 1000 || (pageToken && tokens.has(pageToken))) throw new Error("too-many-devices");
        tokens.add(pageToken);
      } while (pageToken);
      return { files };
    }
    if (payload.op === "read") return request(`${API}/${safeFileId(payload.fileId)}?alt=media`);
    const { document, deviceId } = payload;
    if (!validId(deviceId) || document?.deviceId !== deviceId || document?.schema !== DRIVE_SCHEMA || document.accountId !== session.accountId) throw new Error("invalid-document");
    cleanState(document.state);
    const body = JSON.stringify(document);
    if (new TextEncoder().encode(body).length > MAX_BYTES) throw new Error("payload-too-large");
    if (payload.fileId) {
      const id = safeFileId(payload.fileId);
      const file = await request(`${API}/${id}?fields=id,appProperties`);
      if (file.appProperties?.schema !== DRIVE_SCHEMA || file.appProperties?.deviceId !== deviceId) throw new Error("wrong-device-file");
      return request(`${UPLOAD}/${id}?uploadType=media&fields=id`, { method: "PATCH", headers: { "content-type": "application/json; charset=utf-8" }, body });
    }
    const boundary = `maintenpro_${crypto.randomUUID().replaceAll("-", "")}`;
    const metadata = { name: `MaintenPro_${deviceId}.json`, mimeType: "application/json", parents: ["appDataFolder"], appProperties: { schema: DRIVE_SCHEMA, deviceId } };
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${body}\r\n--${boundary}--\r\n`;
    return request(`${UPLOAD}?uploadType=multipart&fields=id`, { method: "POST", headers: { "content-type": `multipart/related; boundary=${boundary}` }, body: multipart });
  };
}
