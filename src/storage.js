// Demo data never replaces the user's inventory or Google Play entitlement.
export const demoMode = new URLSearchParams(location.search).get("demo") === "1";
export const storageProblems = [];
const prefix = demoMode ? "demo." : "";
const keyFor = key => prefix + key;
const journalKey = keyFor("toolstock.transaction.v1");
try {
  const pending = localStorage.getItem(journalKey);
  if (pending !== null) {
    const previous = JSON.parse(pending);
    if (!previous || typeof previous !== "object" || Array.isArray(previous)) throw new Error("Invalid transaction");
    for (const [key, value] of Object.entries(previous)) {
      if (!key.startsWith("toolstock.") || (value !== null && typeof value !== "string")) throw new Error("Invalid transaction key");
      if (value === null) localStorage.removeItem(keyFor(key));
      else localStorage.setItem(keyFor(key), value);
    }
    localStorage.removeItem(journalKey);
  }
} catch { storageProblems.push("toolstock.transaction.v1"); }
export const storage = {
  getItem: key => localStorage.getItem(keyFor(key)),
  setItem: (key, value) => storage.writeBatch({ [key]: value }),
  removeItem: key => localStorage.removeItem(keyFor(key)),
  readJSON(key, fallback, validate = () => true) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      if (!validate(value)) throw new Error("Formato de datos incorrecto");
      return value;
    } catch {
      storageProblems.push(key);
      return fallback;
    }
  },
  writeBatch(values, recovery = false) {
    if (storageProblems.length && !recovery) throw new Error("Hay datos dañados. Guarda la copia de recuperación y restaura una copia válida antes de modificar el inventario.");
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, storage.getItem(key)]));
    try {
      localStorage.setItem(journalKey, JSON.stringify(previous));
      for (const [key, value] of Object.entries(values)) localStorage.setItem(keyFor(key), value);
      localStorage.removeItem(journalKey);
    } catch (error) {
      for (const [key, value] of Object.entries(previous)) {
        if (value === null) localStorage.removeItem(keyFor(key));
        else localStorage.setItem(keyFor(key), value);
      }
      localStorage.removeItem(journalKey);
      throw new Error("No se pudieron guardar los datos. Comprueba el espacio disponible y vuelve a intentarlo.", { cause: error });
    }
  }
};
