/**
 * Stylesheets are handled by the bundler, not the type system. Next ships
 * declarations for relative CSS imports only, so this covers the aliased
 * `@/styles/*` form used in the root layout.
 */
declare module "*.css";
