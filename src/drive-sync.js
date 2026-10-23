const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FILE_NAME = "toolstock-sync-v1.json";
const SCHEMA_VERSION = 1;

const now = () => new Date().toISOString();
const randomId = () => globalThis.crypto?.randomUUID?.() || `toolstock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const asObject = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const asArray = value => Array.isArray(value) ? value : [];
const stamp = value => Date.parse(value?.updatedAt || value?.createdAt || "") || 0;

async function jsonResponse(response) {
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) {
    const message = body.error?.message || `Google Drive respondió ${response.status}`;
    throw new Error(message);
  }
  return body;
}

async function driveRequest(path, token, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return jsonResponse(await fetch(`${DRIVE_API}${path}`, { ...options, headers }));
}

function mergeById(local, remote) {
  const result = new Map();
  for (const item of [...asArray(remote), ...asArray(local)]) {
    if (!item || typeof item !== "object") continue;
    const key = String(item.id || item.reference || "");
    if (!key) continue;
    const previous = result.get(key);
    if (!previous || stamp(item) >= stamp(previous)) result.set(key, item);
  }
  return [...result.values()];
}

function mergeSnapshots(local, remote) {
  const left = asObject(local);
  const right = asObject(remote);
  const localData = asObject(left.data);
  const remoteData = asObject(right.data);
  const data = {
    products: mergeById(localData.products, remoteData.products),
    movements: mergeById(localData.movements, remoteData.movements),
    employees: mergeById(localData.employees, remoteData.employees),
    settings: stamp(localData.settings) >= stamp(remoteData.settings) ? localData.settings : remoteData.settings
  };
  const updatedAt = Math.max(Date.parse(left.updatedAt || "") || 0, Date.parse(right.updatedAt || "") || 0)
    ? new Date(Math.max(Date.parse(left.updatedAt || "") || 0, Date.parse(right.updatedAt || "") || 0)).toISOString()
    : now();
  return {
    schemaVersion: SCHEMA_VERSION,
    clientId: left.clientId || right.clientId || randomId(),
    updatedAt,
    revision: Math.max(Number(left.revision) || 0, Number(right.revision) || 0) + 1,
    data
  };
}

function equalData(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createDriveSync({ getSnapshot, setSnapshot, getAccessToken, onStatus = () => {} }) {
  if (typeof getSnapshot !== "function" || typeof setSnapshot !== "function") {
    throw new Error("ToolStockDrive requiere funciones de lectura y escritura");
  }

  async function token() {
    if (typeof getAccessToken !== "function") throw new Error("Vincula la cuenta de Google del dispositivo antes de sincronizar");
    const value = await getAccessToken();
    if (!value || typeof value !== "string") throw new Error("No se obtuvo un token de Google Drive");
    return value;
  }

  async function findRemote(accessToken) {
    const query = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const result = await driveRequest(`/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime,size,md5Checksum)&pageSize=1`, accessToken);
    return result.files?.[0] || null;
  }

  async function readRemote(file, accessToken) {
    return driveRequest(`/files/${encodeURIComponent(file.id)}?alt=media`, accessToken);
  }

  async function writeRemote(snapshot, file, accessToken) {
    const boundary = `toolstock-${Date.now()}`;
    const metadata = JSON.stringify(file ? { name: FILE_NAME, mimeType: "application/json" } : {
      name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json"
    });
    const payload = JSON.stringify(snapshot);
    const multipart = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      payload,
      `--${boundary}--`,
      ""
    ].join("\r\n");
    const path = file
      ? `/files/${encodeURIComponent(file.id)}?uploadType=multipart&fields=id,name,modifiedTime,size`
      : "/files?uploadType=multipart&fields=id,name,modifiedTime,size";
    const response = await fetch(`${DRIVE_UPLOAD}${path}`, {
      method: file ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipart
    });
    return jsonResponse(response);
  }

  async function sync() {
    onStatus({ state: "working", message: "Comprobando la copia privada de Google Drive…" });
    const accessToken = await token();
    const local = { ...asObject(await getSnapshot()), schemaVersion: SCHEMA_VERSION };
    const file = await findRemote(accessToken);
    const remote = file ? await readRemote(file, accessToken) : null;
    const merged = remote ? mergeSnapshots(local, remote) : {
      ...local,
      clientId: local.clientId || randomId(),
      updatedAt: local.updatedAt || now(),
      revision: (Number(local.revision) || 0) + 1,
      data: asObject(local.data)
    };
    const changed = !remote || !equalData(merged.data, remote.data);
    const finalSnapshot = remote && !changed
      ? { ...remote, clientId: local.clientId || remote.clientId, data: remote.data }
      : merged;
    await setSnapshot(finalSnapshot);
    if (changed) await writeRemote(finalSnapshot, file, accessToken);
    const result = { state: "ready", message: file ? "Móvil y PC sincronizados" : "Copia privada creada en Google Drive", fileId: file?.id || null, revision: finalSnapshot.revision };
    onStatus(result);
    return result;
  }

  return { sync, mergeSnapshots, fileName: FILE_NAME, schemaVersion: SCHEMA_VERSION };
}
