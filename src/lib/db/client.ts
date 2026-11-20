import dotenv from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Add your PostgreSQL connection string to .env.local.",
  );
}

const globalForDatabase = globalThis as typeof globalThis & {
  crmPgPool?: Pool;
};

export const pool =
  globalForDatabase.crmPgPool ??
  new Pool({ connectionString, max: 5 });

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

globalForDatabase.crmPgPool = pool;

export const db = drizzle(pool, { schema });
