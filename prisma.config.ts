import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * From Prisma 7 the connection URL lives here rather than in the schema, and
 * the runtime client is built with a driver adapter (see src/server/db.ts).
 *
 * `.env.local` is loaded explicitly because the CLI runs outside Next.js and
 * would not otherwise see it. It is optional so that commands which do not
 * touch a database — `prisma validate`, `prisma format`, `prisma generate` —
 * still work on a fresh checkout with no environment configured.
 */
const envFile = path.join(process.cwd(), ".env.local");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
