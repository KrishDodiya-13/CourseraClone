/**
 * Node resolve hook that swaps `@/server/auth` for a controllable stub.
 *
 * The admin actions authorise through `assertAdmin()`, which reads the session
 * via `auth()`. Outside a Next request there is no session to read, so a
 * standalone check could not otherwise exercise the guard at all — which is
 * exactly the code most worth exercising.
 *
 * Substituting the session source, and nothing else, keeps the real `authz`
 * helpers and the real action bodies under test. The stub reads whichever
 * identity the check has set in `globalThis.__testSession`, so one process can
 * try the same action as a student, an instructor and an admin.
 */
const STUB = `
export async function auth() {
  return globalThis.__testSession ?? null;
}
export const handlers = {};
export const signIn = async () => {};
export const signOut = async () => {};
export const googleAuthEnabled = false;
`;

const AUTH_MODULE = /(^|\/)server\/auth(\/index)?(\.[jt]s)?$/;

/**
 * `revalidatePath` needs Next's per-request store and throws without one. It is
 * a cache hint, not part of the decision an action makes, so it is stubbed out
 * rather than worked around in the action itself.
 */
const CACHE_STUB = `
export function revalidatePath() {}
export function revalidateTag() {}
export function unstable_cache(fn) { return fn; }
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { shortCircuit: true, url: "data:text/javascript,export{}" };
  }

  const normalised = specifier.split("\\").join("/").replace(/^@\//, "src/");

  if (specifier === "next/cache") {
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(CACHE_STUB)}`,
    };
  }

  if (AUTH_MODULE.test(normalised)) {
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(STUB)}`,
    };
  }

  return nextResolve(specifier, context);
}
