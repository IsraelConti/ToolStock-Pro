import { canonical, cleanState, DRIVE_SCHEMA, mergeStates, validId } from "./drive-state.js";

export class DriveSync {
  constructor({ transport, readState, applyState, config, persist, onStatus = () => {}, now = () => new Date().toISOString() }) {
    Object.assign(this, { transport, readState, applyState, config, persist, onStatus, now });
    this.running = false;
    this.queued = false;
    this.timer = null;
    this.generation = 0;
    this.stopped = false;
  }
  async status() { return this.transport({ op: "status" }); }
  changed() {
    this.config.pending = true;
    this.persist(this.config);
    if (this.stopped) return;
    if (this.running) this.queued = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync().catch(() => {}), 1500);
  }
  start() { this.stopped = false; }
  stop() { clearTimeout(this.timer); this.queued = false; this.stopped = true; this.generation++; }
  async sync() {
    if (this.running) { this.queued = true; return false; }
    if (this.stopped) return false;
    this.running = true;
    const generation = this.generation;
    try {
      const status = await this.status();
      if (!status.configured) throw new Error("configuration-missing");
      if (!status.connected || !status.accountId) throw new Error("sign-in-required");
      if (!status.entitled) throw new Error("purchase-required");
      if (this.config.accountId && this.config.accountId !== status.accountId) throw new Error("account-mismatch");
      if (!validId(this.config.deviceId)) throw new Error("invalid-device");
      this.onStatus({ state: "syncing", text: "Uniendo los cambios con tu Drive…" });
      const files = await this.transport({ op: "list" });
      if (!Array.isArray(files?.files)) throw new Error("invalid-response");
      const states = [];
      for (const file of files.files) {
        const document = await this.transport({ op: "read", fileId: file.id });
        if (document?.schema !== DRIVE_SCHEMA || document.accountId !== status.accountId || !validId(document.deviceId)) throw new Error("invalid-document");
        states.push(document.state);
      }
      // Read the current state after the network awaits so an edit made during
      // download is included. Every device writes only its own file.
      const local = cleanState(this.readState());
      const merged = mergeStates([local, ...states]);
      const owned = files.files.filter(f => f.deviceId === this.config.deviceId).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0];
      const document = { schema: DRIVE_SCHEMA, accountId: status.accountId, deviceId: this.config.deviceId, savedAt: this.now(), state: merged };
      if (this.stopped || generation !== this.generation) return false;
      await this.transport({ op: "write", fileId: owned?.id || "", deviceId: this.config.deviceId, document });
      const latest = cleanState(this.readState());
      const duringUpload = canonical(latest) !== canonical(local);
      const finalState = mergeStates([merged, latest]);
      if (this.stopped || generation !== this.generation) return false;
      // applyState must be atomic: a failed local save must not discard edits.
      if (this.applyState(finalState) === false) throw new Error("local-storage-full");
      this.config.accountId = status.accountId;
      this.config.email = status.email || "";
      this.config.lastSync = this.now();
      this.config.pending = duringUpload;
      this.config.error = "";
      this.persist(this.config);
      this.queued = this.queued || duringUpload;
      this.onStatus({ state: "ready", conflicts: finalState.conflicts.length, text: finalState.conflicts.length ? `Sincronizado. ${finalState.conflicts.length} cambio(s) simultáneo(s) conservados para revisar.` : "Sincronizado con tu Drive. El móvil y el PC utilizan la misma cuenta." });
      return true;
    } catch (error) {
      this.config.pending = true;
      this.config.error = error?.message || "offline";
      this.persist(this.config);
      this.onStatus({ state: "error", reason: this.config.error, text: driveErrorMessage(this.config.error) });
      throw error;
    } finally {
      this.running = false;
      if (this.queued && !this.stopped) { this.queued = false; this.changed(); }
    }
  }
}
export function driveErrorMessage(reason) {
  return ({
    "configuration-missing": "Falta activar la conexión de Google del editor. Tus datos siguen guardados en este dispositivo.",
    "sign-in-required": "Conecta la misma cuenta de Google que utilizas en el móvil y el PC.",
    "purchase-required": "Vincula la compra desde el móvil. El acceso al PC se incluye con tu compra activa.",
    "account-mismatch": "Este dispositivo conserva datos de otra cuenta. Exporta una copia y vacía sus datos antes de conectar una cuenta diferente; no se han enviado registros.",
    "invalid-document": "Hay un archivo de sincronización no válido en Drive. No se ha sustituido ni borrado ningún dato.",
    "invalid-response": "Drive no devolvió una respuesta válida. Tus cambios siguen pendientes.",
    "local-storage-full": "No hay espacio local para incorporar la copia de Drive. Exporta una copia y reduce las fotografías.",
    "quota-exceeded": "Tu Drive no tiene espacio o ha alcanzado su límite temporal. Tus cambios siguen pendientes.",
    "authorization-required": "Google necesita que vuelvas a conectar tu cuenta. Tus datos locales se conservan.",
    "payload-too-large": "La copia es demasiado grande. Reduce las fotografías antes de sincronizar.",
    "too-many-devices": "La cuenta tiene demasiados dispositivos para esta versión. No se han sobrescrito los datos."
  })[reason] || "No se pudo sincronizar ahora. Los datos siguen guardados aquí y se reintentará al recuperar la conexión.";
}
