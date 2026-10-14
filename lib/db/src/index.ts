import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// A managed database (e.g. DigitalOcean) uses its own certificate: set DATABASE_CA_CERT to it (PEM) so the connection is encrypted and verified.
const ca = process.env.DATABASE_CA_CERT;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}) });
export const db = drizzle(pool, { schema });

export * from "./schema";
