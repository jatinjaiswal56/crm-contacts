import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/lib/db/client";

async function main() {
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.info("PostgreSQL migrations applied.");
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Failed to apply PostgreSQL migrations.", error);
  process.exitCode = 1;
});
