import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  console.log("[migrations] starting...");
  try {
    const migrationsPath = path.join(__dirname, "../migrations");
    await migrate(db, { migrationsFolder: migrationsPath });
    console.log("[migrations] completed successfully");
  } catch (err) {
    console.error("[migrations] failed:", err);
    throw err;
  }
}
