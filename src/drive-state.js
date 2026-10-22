const clone=value=>JSON.parse(JSON.stringify(value));
// A separate snapshot per device prevents two computers from overwriting one file.
// Version vectors detect concurrent edits; the losing value remains recoverable.
export const DRIVE_SCHEMA = "maintenpro.drive.v1";
export const COLLECTIONS = ["equipment", "orders", "plans", "team"];
export const SHARED_SETTINGS = ["appName", "companyName", "ownerEmail", "language", "currency", "tax", "alertDays", "urgentDays", "notifications", "updatedAt", "_mpSync"];
const idPattern = /^[A-Za-z0-9_-]{1,80}$/;
export const validId = value => typeof value === "string" && idPattern.test(value);
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter(k => !["__proto__", "prototype", "constructor"].includes(k)).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function vector(row) {
  const result = {};
  const source = row?._mpSync?.vector;
  if (!source || typeof source !== "object" || Array.isArray(source)) return result;
  for (const [key, n] of Object.entries(source)) if (validId(key) && Number.isSafeInteger(n) && n > 0) result[key] = n;
  if (Object.keys(result).length > 256) throw new Error("too-many-devices");
  return result;
}
export function unionVectors(...rows) {
  const result = {};
  for (const row of rows) for (const [key, n] of Object.entries(vector(row))) result[key] = Math.max(result[key] || 0, n);
  return result;
}
function dominates(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return keys.size > 0 && [...keys].every(k => (a[k] || 0) >= (b[k] || 0)) && [...keys].some(k => (a[k] || 0) > (b[k] || 0));
}
function time(row) {
  const n = Date.parse(row?.deletedAt || row?.updatedAt || row?.createdAt || "");
  return Number.isFinite(n) ? n : 0;
}
function rank(row) {
  const entries = Object.entries(vector(row)).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0], "en"));
  return [entries[0]?.[1] || 0, entries[0]?.[0] || "", time(row), canonical(row)];
}
export function compareRows(a, b) {
  const av = vector(a), bv = vector(b);
  if (dominates(av, bv)) return 1;
  if (dominates(bv, av)) return -1;
  const ar = rank(a), br = rank(b);
  for (let i = 0; i < ar.length; i++) if (ar[i] !== br[i]) return ar[i] > br[i] ? 1 : -1;
  return 0;
}
function concurrent(a, b) {
  if (canonical(a) === canonical(b)) return false;
  const av = vector(a), bv = vector(b);
  if (!Object.keys(av).length && !Object.keys(bv).length) return time(a) === time(b);
  return !dominates(av, bv) && !dominates(bv, av);
}
export function cleanState(state) {
  const out = { version: 2 };
  for (const name of COLLECTIONS) {
    if (!Array.isArray(state?.[name]) || state[name].some(row => !row || typeof row !== "object" || Array.isArray(row) || !validId(row.id))) throw new Error("invalid-records");
    out[name] = clone(state[name]);
  }
  out.settings = {};
  for (const key of SHARED_SETTINGS) if (state?.settings && key in state.settings) out.settings[key] = clone(state.settings[key]);
  out.conflicts = Array.isArray(state?.conflicts) ? clone(state.conflicts) : [];
  return out;
}
export function mergeStates(states) {
  const out = { version: 2, equipment: [], orders: [], plans: [], team: [], settings: {}, conflicts: [] };
  const candidates = [];
  for (const raw of states) {
    const state = cleanState(raw);
    for (const collection of COLLECTIONS) {
      const merged = new Map(out[collection].map(row => [row.id, row]));
      for (const row of state[collection]) {
        const previous = merged.get(row.id);
        if (!previous) { merged.set(row.id, row); continue; }
        const winner = compareRows(row, previous) > 0 ? row : previous;
        const other = winner === row ? previous : row;
        if (concurrent(row, previous)) candidates.push({ collection, id: row.id, alternative: other });
        merged.set(row.id, winner);
      }
      out[collection] = [...merged.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    }
    if (!Object.keys(out.settings).length || compareRows(state.settings, out.settings) > 0) out.settings = state.settings;
    candidates.push(...state.conflicts);
  }
  const seen = new Set();
  for (const conflict of candidates) {
    if (!COLLECTIONS.includes(conflict?.collection) || !validId(conflict?.id) || conflict.alternative?.id !== conflict.id) continue;
    const current = out[conflict.collection].find(row => row.id === conflict.id);
    if (!current || canonical(current) === canonical(conflict.alternative) || dominates(vector(current), vector(conflict.alternative))) continue;
    const key = canonical(conflict);
    if (!seen.has(key)) { seen.add(key); out.conflicts.push(conflict); }
  }
  if (out.conflicts.length > 1000) throw new Error("too-many-conflicts");
  return out;
}
function withoutStamp(row) { const copy = { ...row }; delete copy._mpSync; return copy; }
export function stampChanges(previous, incoming, deviceId, counter = 0) {
  if (!validId(deviceId)) throw new Error("invalid-device");
  const state = cleanState(incoming);
  const observed = [previous, state].filter(Boolean).flatMap(s => [...COLLECTIONS.flatMap(k => s[k] || []), s.settings || {}]);
  for (const row of observed) for (const n of Object.values(vector(row))) counter = Math.max(counter, n);
  const stamp = (row, old) => {
    if (old && canonical(withoutStamp(old)) === canonical(withoutStamp(row))) return row;
    counter += 1;
    if (!Number.isSafeInteger(counter)) throw new Error("invalid-clock");
    return { ...row, _mpSync: { vector: { ...unionVectors(old, row), [deviceId]: counter } } };
  };
  for (const name of COLLECTIONS) {
    const old = new Map((previous?.[name] || []).map(row => [row.id, row]));
    state[name] = state[name].map(row => stamp(row, old.get(row.id)));
  }
  state.settings = stamp(state.settings, previous?.settings);
  return { state, counter };
}
export function resolveConflict(state, conflict, useAlternative, deviceId, counter) {
  const next = cleanState(state);
  const current = next[conflict.collection]?.find(row => row.id === conflict.id);
  if (!current) throw new Error("missing-record");
  const chosen = useAlternative ? conflict.alternative : current;
  const replacement = { ...chosen, updatedAt: new Date().toISOString(), _mpSync: { vector: unionVectors(current, conflict.alternative) } };
  next[conflict.collection] = next[conflict.collection].map(row => row.id === conflict.id ? replacement : row);
  const stamped = stampChanges(state, next, deviceId, counter);
  return { ...stamped, state: mergeStates([stamped.state]) };
}
