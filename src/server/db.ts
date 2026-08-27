import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * The Prisma client singleton.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every edit until Postgres refuses more. Caching the
 * instance on `globalThis` keeps exactly one pool alive across reloads; in
 * production the module is evaluated once and the cache is unused.
 *
 * Prisma 7 requires a driver adapter for a direct connection, so the pool is
 * `pg`'s and the connection string is read here rather than from the schema.
 */
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Postgres instance.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Production cache.
 *
 * Development reuses the `globalThis` entry above so a hot reload does not leak
 * a pool. Production deliberately does not touch `globalThis`, so it needs its
 * own module-scoped cache - without one, lazy construction would build a fresh
 * client, and a fresh pool, on every property access.
 */
let client: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  client ??= globalForPrisma.prisma ?? createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

/**
 * `db` is a lazy handle, not a client.
 *
 * The client used to be constructed during module evaluation:
 *
 *     export const db = globalForPrisma.prisma ?? createPrismaClient();
 *
 * which meant *importing* this module demanded DATABASE_URL. `next build`
 * imports it: collecting page data loads every route's module graph in Node,
 * including routes that never query anything, so the build died on a variable
 * it had no reason to need yet - the error surfaced against whichever route was
 * collected first, `/_not-found` or `/api/auth/[...nextauth]`.
 *
 * A Proxy defers construction to the first property access. Nothing happens on
 * import; `db.user.findMany()` builds the client on demand and every later call
 * reuses it. This keeps the export a `PrismaClient`, so all 38 call sites -
 * queries, server actions, route handlers, the Auth.js adapter - are unchanged.
 *
 * The validation is not weakened, only moved: a real database operation with no
 * DATABASE_URL still throws the same error, at the moment it is genuinely
 * missing rather than at import time. `server-only` above keeps the whole
 * module, connection string included, out of any client bundle.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const prisma = getPrismaClient();
    const value = Reflect.get(prisma, property) as unknown;

    // `$transaction`, `$queryRaw` and friends need their original receiver;
    // model delegates (`db.user`) are plain objects and pass through as-is.
    return typeof value === "function" ? value.bind(prisma) : value;
  },

  has(_target, property) {
    return Reflect.has(getPrismaClient(), property);
  },
});
