import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Separate build directories for dev and production.
   *
   * `next dev` and `next build` write incompatible artefacts into the same
   * `.next` folder, and dev reconciles that on startup partly by `readlink`-ing
   * entries such as `.next/diagnostics`. On a OneDrive-synced path that
   * readlink returns EINVAL rather than a normal error, which is fatal: the dev
   * server exits during startup, so *every* route becomes unreachable — the
   * symptom that looked like "the login and signup pages will not load".
   *
   * Giving each mode its own directory means they never share state, so the
   * reconciliation that trips over the synced filesystem never runs. Production
   * output stays in `.next`, so deployment and `next start` are unaffected.
   */
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",

  // Deliberately off for now. The navbar and footer link to routes that land in
  // later phases; `typedRoutes` would reject those hrefs at build time and push
  // us into casting every link, which defeats the point of the check.
  // `src/lib/routes.ts` is the single source of truth instead.
  typedRoutes: false,

  images: {
    remotePatterns: [],
  },

  /**
   * Security headers.
   *
   * The four CSP directives here are the ones that can be set without a nonce.
   * `script-src` is deliberately absent: Next injects inline bootstrap scripts,
   * so restricting it properly needs per-request nonces threaded through
   * middleware, and a CSP that has to carry `'unsafe-inline'` to work buys
   * almost nothing while looking like it buys a lot. Better to ship the
   * directives that are real than a header that only reads as secure.
   *
   * `frame-ancestors 'none'` matters more than usual here: certificates are
   * deliberately public, shareable URLs, which makes them the natural target
   * for framing inside a page that misrepresents what the viewer is confirming.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            // NOTE: `default-src` is deliberately absent, and removing it was a
            // bug fix, not an omission. With `default-src 'self'` and no
            // `script-src`, the former becomes the fallback for scripts and
            // Next's inline bootstrap is blocked — every page renders as an
            // empty body. It passed a curl check and failed the moment a real
            // browser loaded it, which is the whole argument for testing
            // headers in a browser.
            value: [
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // Redundant with frame-ancestors for modern browsers, kept for old ones.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // The app asks for none of these; saying so stops an embedded
            // third party asking on its behalf.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            // Only honoured over HTTPS, so it is inert in local development and
            // takes effect the moment the app is served from a real origin.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

/**
 * Service worker build.
 *
 * Disabled in development: a precaching worker serving stale chunks against a
 * dev server that rebuilds constantly produces failures that look like
 * application bugs and are not.
 */
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,

  /**
   * Precache the /offline document itself.
   *
   * Serwist's generated manifest covers build assets — the JS chunks for the
   * route — but not the HTML document that loads them. Without this entry the
   * navigation fallback points at a URL that was never cached, so an offline
   * navigation fails outright. The revision is tied to the build so a deploy
   * replaces the cached copy rather than serving a stale shell forever.
   */
  additionalPrecacheEntries: [
    { url: "/offline", revision: process.env.BUILD_ID ?? String(Date.now()) },
  ],
});

export default withSerwist(nextConfig);
