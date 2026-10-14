// Applies the v2 migrations (./migrations) to DATABASE_URL. Safe to run on every deploy: already-applied ones are skipped,
// and they run inside a transaction. Run with: pnpm --filter @workspace/db run migrate
// For a managed database with its own certificate, set DATABASE_CA_CERT to the CA certificate (PEM).
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set."); process.exit(1); }
const ca = process.env.DATABASE_CA_CERT;
const pool = new pg.Pool({ connectionString: url, ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}) });
const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

try {
  await migrate(drizzle(pool), { migrationsFolder: folder, migrationsTable: "__portal_migrations" });
  console.log("Migrations applied.");
} catch (e) {
  console.error("Migration failed; nothing from the failing migration was kept.", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
