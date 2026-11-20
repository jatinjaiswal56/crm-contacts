import { mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

async function main() {
  await mkdir("./data", { recursive: true });

  const db = new PGlite("./data/pglite");
  await db.waitReady;

  const server = new PGLiteSocketServer({
    db,
    host: "127.0.0.1",
    port: 5432,
    maxConnections: 10,
  });

  try {
    await server.start();
  } catch (error) {
    await db.close();
    throw error;
  }

  console.info("Local PostgreSQL-compatible database listening on 127.0.0.1:5432");

  const shutdown = async () => {
    await server.stop();
    await db.close();
    console.info("Local database stopped.");
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown().catch((error: unknown) => {
        console.error("Failed to stop the local database cleanly:", error);
        process.exitCode = 1;
      });
    });
  }
}

main().catch((error: unknown) => {
  console.error("Failed to start the local database:", error);
  process.exitCode = 1;
});
