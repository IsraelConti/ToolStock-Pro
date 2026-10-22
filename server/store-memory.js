export function createMemoryStore() {
  const accounts = new Map();
  const blank = () => ({ email: "", revision: 0, records: [], settings: {}, settingsRevision: 0, purchaseToken: "" });
  return {
    async ensureAccount(sub, email) {
      const current = accounts.get(sub) || blank();
      current.email = email || current.email;
      accounts.set(sub, current);
      return { ...current, records: current.records.map(row => ({ ...row, payload: { ...row.payload } })) };
    },
    async load(sub) {
      const current = accounts.get(sub) || blank();
      return {
        revision: current.revision,
        records: current.records.map(row => ({ ...row, payload: { ...row.payload } })),
        settings: { ...current.settings },
        settingsRevision: current.settingsRevision
      };
    },
    async save(sub, state) {
      const current = accounts.get(sub) || blank();
      accounts.set(sub, {
        email: current.email || "",
        revision: state.revision,
        records: state.records.map(row => ({ ...row, payload: { ...row.payload } })),
        settings: { ...state.settings },
        settingsRevision: state.settingsRevision,
        purchaseToken: current.purchaseToken || ""
      });
    },
    async getPurchaseToken(sub) {
      return accounts.get(sub)?.purchaseToken || "";
    },
    async setPurchaseToken(sub, token) {
      for (const [owner, row] of accounts) if (owner !== sub && row.purchaseToken === token) return false;
      const current = accounts.get(sub) || blank();
      current.purchaseToken = token;
      accounts.set(sub, current);
      return true;
    }
  };
}
