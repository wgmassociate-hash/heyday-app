// Prisma 7 runtime client — instantiated with the pg driver adapter (schema.prisma
// no longer carries a `url`, see prisma.config.ts for the CLI-side connection string).
//
// Returns null when DATABASE_URL is unset so callers (server/db/repositories/*)
// can fall back to 1.0's file-based storage instead of crashing the app.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma/client/index.js";

let client: PrismaClient | null = null;
let attempted = false;

export function getPrismaClient(): PrismaClient | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!attempted) {
    attempted = true;
    const adapter = new PrismaPg({
      connectionString,
      // Fail fast in dev when Postgres isn't running yet, rather than hanging
      // the request for the platform default TCP timeout.
      connectionTimeoutMillis: 2000,
    });
    client = new PrismaClient({ adapter });
  }

  return client;
}
