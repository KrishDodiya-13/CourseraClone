import { z } from "zod";

/**
 * Environment contract. Validated once at module load so a missing or
 * malformed variable fails loudly at boot rather than deep inside a request.
 *
 * Server variables are only parsed on the server. `process.env` on the client
 * contains nothing but the NEXT_PUBLIC_ keys, so validating the server schema
 * in the browser would fail for reasons that have nothing to do with the
 * deployment being wrong.
 */

const isServer = typeof window === "undefined";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Postgres connection string. Required from Phase 3 (data layer) onward. */
  DATABASE_URL: z.string().min(1),

  /**
   * Signs and encrypts the session JWT. Generate with `openssl rand -base64 32`.
   * Rotating it invalidates every existing session.
   */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  /**
   * Google OAuth. Both must be present for the provider to be registered;
   * absent is a valid configuration and simply disables Google sign-in.
   */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  /** Set only in dev/test to print reset links instead of sending email. */
  AUTH_DEBUG_PRINT_TOKENS: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

/**
 * An empty string is what several hosts (including Vercel, when a project's
 * env var is added but left blank) send for an "unset" variable — `process.env`
 * has no way to represent "absent" once a platform touches it. Without this,
 * `z.url()` sees `""`, which is a string and therefore never falls through to
 * `.default()`, and fails validation for a variable that was never really
 * configured rather than misconfigured.
 */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.preprocess(blankToUndefined, z.url().default("http://localhost:3000")),
  NEXT_PUBLIC_APP_NAME: z.preprocess(blankToUndefined, z.string().default("Coursera")),
});

const parsedClient = clientSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});

if (!parsedClient.success) {
  console.error("Invalid client environment variables:", z.treeifyError(parsedClient.error));
  throw new Error("Invalid client environment variables. See .env.example.");
}

export const clientEnv = parsedClient.data;

type ServerEnv = z.infer<typeof serverSchema> & typeof clientEnv;

let serverEnv: ServerEnv | undefined;

/**
 * Parses and caches the server environment on first read.
 *
 * This used to run in an IIFE at module load, which meant merely *importing*
 * this module required DATABASE_URL and AUTH_SECRET. `next build` imports it
 * while collecting page data - a phase that runs every route's module graph in
 * Node without serving a request - so a build had to be given production
 * secrets to get past a step that never touches them. Deferring the parse to
 * first read keeps the contract exactly as strict at runtime while letting the
 * build load the module. See the matching note in `@/server/db`.
 */
function loadServerEnv(): ServerEnv {
  if (serverEnv) return serverEnv;

  const parsedServer = serverSchema.safeParse(process.env);
  if (!parsedServer.success) {
    console.error("Invalid server environment variables:", z.treeifyError(parsedServer.error));
    throw new Error("Invalid server environment variables. See .env.example.");
  }

  serverEnv = { ...parsedServer.data, ...clientEnv };
  return serverEnv;
}

/**
 * Server configuration. Accessing this from client code throws rather than
 * silently returning undefined, which is the failure mode that leaks secrets
 * into a bundle.
 */
export const env = new Proxy({} as ServerEnv, {
  get(_target, property) {
    if (!isServer) {
      if (property in clientEnv) {
        return clientEnv[property as keyof typeof clientEnv];
      }
      throw new Error(
        `Attempted to read server environment variable "${String(property)}" on the client.`,
      );
    }

    return Reflect.get(loadServerEnv(), property) as unknown;
  },

  has(_target, property) {
    return isServer ? Reflect.has(loadServerEnv(), property) : property in clientEnv;
  },
});

/** True when both Google credentials are configured. */
export const isGoogleAuthEnabled =
  isServer && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
