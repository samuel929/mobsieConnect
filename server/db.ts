import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { AppError } from "./errors";

declare global {
  var __mobsiePool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new AppError(503, "DATABASE_NOT_CONFIGURED", "The database is not configured.");
  }
  return new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false },
    application_name: "mobsie-admin",
  });
}

export function getPool() {
  if (!global.__mobsiePool) global.__mobsiePool = createPool();
  return global.__mobsiePool;
}

export function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
) {
  return getPool().query<T>(text, [...values]);
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
