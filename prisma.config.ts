// Prisma 7 CLI config (migrate/generate/studio only — the app's own runtime
// PrismaClient is instantiated separately with a driver adapter, see
// server/db/prismaClient.ts). Docs: https://pris.ly/d/prisma7-client-config
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "server/db/prisma/schema.prisma",
  migrations: {
    path: "server/db/prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
