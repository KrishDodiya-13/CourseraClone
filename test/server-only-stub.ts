/**
 * Test-time replacement for the `server-only` package.
 *
 * The real module throws when imported outside a React Server Component,
 * which is precisely its job in the app build. Vitest runs in jsdom, so it
 * would trip that guard on every server module and make them untestable.
 * Aliased in vitest.config.ts only — the production build still uses the real
 * package.
 */
export {};
