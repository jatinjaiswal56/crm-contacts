import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Environment loading is the caller's job: Next.js loads .env.local for the
// app, scripts import scripts/load-env.ts first and Vitest uses
// tests/setup-env.ts. Nothing here runs at import time, so `next build`
// works without DATABASE_URL.

type Database = NodePgDatabase<typeof schema>;

const globalForDatabase = globalThis as typeof globalThis & {
  crmPgPool?: Pool;
  crmDb?: Database;
};

/** Shared connection pool, created on first use (reused across dev HMR). */
export function getPool(): Pool {
  if (globalForDatabase.crmPgPool) return globalForDatabase.crmPgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Add your PostgreSQL connection string to .env.local.",
    );
  }

  const pool = new Pool({ connectionString, max: 5 });
  pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
  });
  globalForDatabase.crmPgPool = pool;
  return pool;
}

export function getDb(): Database {
  globalForDatabase.crmDb ??= drizzle(getPool(), { schema });
  return globalForDatabase.crmDb;
}
