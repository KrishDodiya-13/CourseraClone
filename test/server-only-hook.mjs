/**
 * Node resolve hook that maps the `server-only` package to an empty module.
 *
 * The real package throws on import outside a React Server Component — correct
 * in the app, fatal for a standalone integration script. This keeps the actual
 * server modules under test rather than duplicating their logic.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { shortCircuit: true, url: "data:text/javascript,export{}" };
  }
  return nextResolve(specifier, context);
}
