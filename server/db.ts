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
    // Keep the per-instance pool deliberately small. Vercel can run several
    // instances at once and a pool of ten on every instance can exhaust the
    // Neon pooler, leaving even lightweight auth checks waiting for a slot.
    max: Number(process.env.DB_POOL_MAX ?? 3),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 15_000),
    keepAlive: true,
    allowExitOnIdle: true,
    ssl: { rejectUnauthorized: false },
    application_name: "mobsie-admin",
  });
}

function isConnectionAcquisitionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /connection terminated due to connection timeout|connection terminated unexpectedly|connect etimedout|econnreset/i.test(
    `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`,
  );
}

async function resetPool() {
  const pool = global.__mobsiePool;
  global.__mobsiePool = undefined;
  if (pool) await pool.end().catch(() => undefined);
}

export function getPool() {
  if (!global.__mobsiePool) global.__mobsiePool = createPool();
  return global.__mobsiePool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
) {
  try {
    return await getPool().query<T>(text, [...values]);
  } catch (error) {
    // Retry only failures that indicate no usable connection was available.
    // SQL/constraint errors are never retried.
    if (!isConnectionAcquisitionError(error)) throw error;
    await resetPool();
    return getPool().query<T>(text, [...values]);
  }
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
) {
  let client: PoolClient;
  try {
    client = await getPool().connect();
  } catch (error) {
    if (!isConnectionAcquisitionError(error)) throw error;
    await resetPool();
    client = await getPool().connect();
  }
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
