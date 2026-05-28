import { defineConfig } from "drizzle-kit";
import path from "path";
import { config as dotenvConfig } from "dotenv";

// Load workspace root .env for local development (drizzle-kit compiles as CJS so use process.cwd())
dotenvConfig({ path: path.resolve(process.cwd(), "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
