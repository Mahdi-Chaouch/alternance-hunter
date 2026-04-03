/**
 * Singleton PostgreSQL pool shared across all server-side modules.
 * Prevents connection exhaustion on Vercel serverless (each module used to
 * create its own pool — up to 6×10 connections per invocation).
 */

import { Pool } from "pg";
import { getDatabaseUrl, isProduction } from "./env";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pgPool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (!isProduction) {
  globalForDb.pgPool = pgPool;
}
