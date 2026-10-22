import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "migrations", "001_init.sql");

export async function createPgStore(databaseUrl) {
  if (!databaseUrl) throw new Error("Falta DATABASE_URL");
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const migration = await readFile(migrationPath, "utf8");
  await pool.query(migration);
  return {
    async ensureAccount(sub, email) {
      await pool.query(
        `INSERT INTO accounts (id, email) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
        [sub, email || ""]
      );
      return this.load(sub);
    },
    async load(sub) {
      const account = await pool.query(`SELECT revision FROM accounts WHERE id = $1`, [sub]);
      const records = await pool.query(
        `SELECT collection, record_id, payload, revision FROM records WHERE account_id = $1`,
        [sub]
      );
      const settings = await pool.query(
        `SELECT payload, revision FROM account_settings WHERE account_id = $1`,
        [sub]
      );
      return {
        revision: Number(account.rows[0]?.revision || 0),
        records: records.rows.map(row => ({ collection: row.collection, id: row.record_id, payload: row.payload, revision: Number(row.revision) })),
        settings: settings.rows[0]?.payload || {},
        settingsRevision: Number(settings.rows[0]?.revision || 0)
      };
    },
    async save(sub, state) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`UPDATE accounts SET revision = $2 WHERE id = $1`, [sub, state.revision]);
        await client.query(`DELETE FROM records WHERE account_id = $1`, [sub]);
        for (const row of state.records) {
          await client.query(
            `INSERT INTO records (account_id, collection, record_id, payload, revision) VALUES ($1, $2, $3, $4::jsonb, $5)`,
            [sub, row.collection, row.id, JSON.stringify(row.payload), row.revision]
          );
        }
        await client.query(
          `INSERT INTO account_settings (account_id, payload, revision) VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (account_id) DO UPDATE SET payload = EXCLUDED.payload, revision = EXCLUDED.revision`,
          [sub, JSON.stringify(state.settings || {}), state.settingsRevision || 0]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async getPurchaseToken(sub) {
      const result = await pool.query(`SELECT purchase_token FROM account_play WHERE account_id = $1`, [sub]);
      return result.rows[0]?.purchase_token || "";
    },
    async setPurchaseToken(sub, token) {
      try {
      await pool.query(
        `INSERT INTO account_play (account_id, purchase_token) VALUES ($1, $2)
         ON CONFLICT (account_id) DO UPDATE SET purchase_token = EXCLUDED.purchase_token, updated_at = NOW()`,
        [sub, token]
      );
      return true;
      } catch(error) { if(error.code === '23505') return false; throw error; }
    },
    async close() {
      await pool.end();
    }
  };
}
