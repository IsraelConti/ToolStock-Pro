import { DriveSync, driveErrorMessage } from "./drive-sync.js";
import { resolveConflict } from "./drive-state.js";

export function setupDriveUi({ demo=false, config, readState, applyState, persist, toast, onEntitlement, onResolved }) {
  const $ = id => document.getElementById(id);
  let last = { state: "idle", text: config.lastSync ? "Cambios pendientes de comprobar con Drive." : "Conecta tu cuenta de Google para unir el móvil y el PC." };
  let profile = null, csrf = "";
  const pending = new Map();
  window.onMaintenProDriveResponse = (id, response) => {
    const task = pending.get(id); if (!task) return;
    pending.delete(id); clearTimeout(task.timer);
    response?.ok ? task.resolve(response.result) : task.reject(new Error(response?.error || "drive-unreachable"));
  };
  async function transport(payload) {
    if(demo) return payload.op === "status" ? {configured:false,connected:false,entitled:false} : Promise.reject(new Error("sign-in-required"));
    if (window.MaintenProAndroid?.requestSyncDrive) return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("drive-unreachable")); }, 45000);
      pending.set(id, { resolve, reject, timer });
      window.MaintenProAndroid.requestSyncDrive(id, JSON.stringify(payload));
    });
    if (!window.MaintenProDesktopBroker) return payload.op === "status" ? { configured: false, connected: false, entitled: false } : Promise.reject(new Error("configuration-missing"));
    if (payload.op === "status") {
      const reply = await fetch("/session/status", { cache: "no-store" });
      if (!reply.ok) throw new Error("authorization-required");
      const data = await reply.json(); csrf = data.csrf || ""; return data;
    }
    if (!csrf) await transport({ op: "status" });
    const reply = await fetch("/drive/rpc", { method: "POST", headers: { "content-type": "application/json", "x-maintenpro-csrf": csrf }, body: JSON.stringify(payload) });
    const data = await reply.json();
    if (!reply.ok || !data.ok) throw new Error(data.error || "drive-unreachable");
    return data.result;
  }
  function render() {
    if ($("syncStatus")) $("syncStatus").textContent = last.text;
    if ($("driveAccount")) $("driveAccount").textContent = profile?.connected ? `Cuenta conectada: ${profile.email}` : "Sin cuenta conectada";
    if ($("driveLastSync")) $("driveLastSync").textContent = config.lastSync ? `Última unión de datos: ${new Date(config.lastSync).toLocaleString()}${config.pending ? " · hay cambios pendientes" : ""}` : "Todavía no se han unido datos con Drive.";
    if ($("syncNow")) $("syncNow").disabled = last.state === "syncing";
    if ($("driveDisconnect")) $("driveDisconnect").disabled = !profile?.connected;
    if ($("showDriveConflicts")) { $("showDriveConflicts").hidden = !readState().conflicts?.length; $("showDriveConflicts").textContent = `Revisar cambios simultáneos (${readState().conflicts?.length || 0})`; }
  }
  const client = new DriveSync({ transport, readState, applyState, config, persist, onStatus: value => { last = value; render(); } });
  async function refresh(sync = false) {
    try {
      profile = await client.status();
      if (window.MaintenProDesktop) onEntitlement(profile.entitled === true);
      if (!profile.configured) last = { state: "setup", text: driveErrorMessage("configuration-missing") };
      else if (!profile.connected) last = { state: "offline", text: driveErrorMessage("sign-in-required") };
      else if (!profile.entitled) last = { state: "closed", text: driveErrorMessage("purchase-required") };
      else if (sync) await client.sync();
      render();
    } catch (error) { last = { state: "error", text: driveErrorMessage(error.message) }; render(); }
  }
  async function connect() {
    if(demo) return toast("El modo revisión usa datos de demostración y no conecta con tu Drive.");
    const status = await client.status().catch(() => ({}));
    if (!status.configured) return toast(driveErrorMessage("configuration-missing"));
    client.start();
    if (window.MaintenProAndroid?.connectSyncDrive) window.MaintenProAndroid.connectSyncDrive();
    else if (window.MaintenProDesktopBroker) location.assign("/session/start");
  }
  async function disconnect() {
    client.stop();
    if (demo) return;
    if (window.MaintenProAndroid?.disconnectSyncDrive) window.MaintenProAndroid.disconnectSyncDrive();
    else if (window.MaintenProDesktopBroker) {
      if (!csrf) await transport({ op: "status" });
      await fetch("/session/disconnect", { method: "POST", headers: { "x-maintenpro-csrf": csrf } });
    }
    profile = null; onEntitlement(false);
    last = { state: "offline", text: "Cuenta desconectada. Tus datos locales y los archivos de Drive se conservan." }; render();
  }
  $("syncSignIn")?.addEventListener("click", () => connect().catch(() => toast("No se pudo abrir la conexión con Google.")));
  $("connectDrive")?.addEventListener("click", () => connect().catch(() => toast("No se pudo abrir la conexión con Google.")));
  $("syncNow")?.addEventListener("click", () => { client.start(); refresh(true); });
  $("driveDisconnect")?.addEventListener("click", () => { if (confirm("¿Desconectar Google en este dispositivo? Los registros locales y de Drive no se borrarán.")) disconnect().catch(() => toast("No se pudo desconectar la sesión. Vuelve a intentarlo.")); });
  $("showDriveConflicts")?.addEventListener("click", () => {
    const modal = $("driveConflicts"); modal.replaceChildren();
    const h = document.createElement("h2"); h.textContent = "Revisar cambios simultáneos"; modal.append(h);
    for (const conflict of readState().conflicts || []) {
      const current = readState()[conflict.collection].find(row => row.id === conflict.id);
      const box = document.createElement("article"), title = document.createElement("h3");
      title.textContent = current?.name || current?.description || conflict.id; box.append(title);
      for (const [label, row, choose] of [["Conservar valor actual", current, false], ["Recuperar la otra modificación", conflict.alternative, true]]) {
        const details = document.createElement("details"), summary = document.createElement("summary"), pre = document.createElement("pre"), button = document.createElement("button");
        summary.textContent = label; pre.textContent = JSON.stringify(row, (key, value) => key === "_mpSync" || key.toLowerCase().includes("photo") ? undefined : value, 2); button.type = "button"; button.className = "btn"; button.textContent = label;
        button.onclick = () => { const result = resolveConflict(readState(), conflict, choose, config.deviceId, config.counter); config.counter = result.counter; if (applyState(result.state) !== false) { persist(config); client.changed(); modal.close(); onResolved(); toast("Resolución guardada. Se enviará a tu Drive."); } };
        details.append(summary, pre, button); box.append(details);
      }
      modal.append(box);
    }
    const close = document.createElement("button"); close.type = "button"; close.className = "btn"; close.textContent = "Cerrar"; close.onclick = () => modal.close(); modal.append(close); modal.showModal();
  });
  window.onMaintenProDriveSessionChanged = () => refresh(true);
  const online = () => refresh(true);
  window.addEventListener("online", online);
  const interval = setInterval(() => { if (!document.hidden) refresh(true); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(true); });
  refresh(true);
  return { changed: () => client.changed(), render, connect, disconnect, stop: () => { client.stop(); clearInterval(interval); window.removeEventListener("online", online); }, refresh };
}
