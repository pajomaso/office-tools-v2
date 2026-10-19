import { defineConfig } from "drizzle-kit";
import path from "path";

// Office tool v2 only: the portal_* tables. `generate` writes SQL migration files to ./migrations (no database needed);
// production applies them with `pnpm --filter @workspace/db run migrate`. Local development can keep using `push`.
export default defineConfig({
  schema: path.join(__dirname, "./src/schema/portal.ts"),
  out: "./migrations", // relative to lib/db (where pnpm runs the script); an absolute path breaks drizzle-kit
  dialect: "postgresql",
  tablesFilter: ["portal_*"],
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://unused" },
});
