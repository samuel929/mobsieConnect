import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { getPool } = await import("../server/db");
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      executed_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  for (const filename of files) {
    const exists = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [filename],
    );
    if (exists.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(await readFile(path.join(migrationsDir, filename), "utf8"));
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.info(`Applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
