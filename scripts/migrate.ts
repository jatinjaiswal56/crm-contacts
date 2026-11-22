import "./load-env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, getPool } from "../src/lib/db/client";

async function main() {
  try {
    await migrate(getDb(), { migrationsFolder: "./drizzle" });
    console.info("PostgreSQL migrations applied.");
  } finally {
    await getPool().end();
  }
}

void main().catch((error: unknown) => {
  console.error("Failed to apply PostgreSQL migrations.", error);
  process.exitCode = 1;
});
