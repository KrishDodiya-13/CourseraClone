/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

/**
 * Service worker.
 *
 * Three jobs, and deliberately no more:
 *
 *  1. precache the app shell so a downloaded course opens with no network;
 *  2. serve cached images from the same store the download manager writes to;
 *  3. fall back to /offline for a navigation that cannot reach the server.
 *
 * What it deliberately does NOT do: cache API responses or anything
 * authenticated. Session cookies, the auth endpoints and the bundle route are
 * all excluded — a cached authenticated response is a cross-account leak on a
 * shared device, and a cached session is worse.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const IMAGE_CACHE = "lumen-offline-images-v1";
const OFFLINE_FALLBACK = "/offline";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Shares the cache name the download manager writes into, so an image
      // pre-cached during download is served from here without a second copy.
      matcher: ({ request }) => request.destination === "image",
      handler: new CacheFirst({
        cacheName: IMAGE_CACHE,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: OFFLINE_FALLBACK,
        matcher: ({ request }) => request.mode === "navigate",
      },
    ],
  },
});

/**
 * Never touch authenticated traffic.
 *
 * Registered before Serwist's own listeners so these requests bypass every
 * caching strategy entirely rather than relying on a strategy to opt out.
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isSensitive =
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/api/learn/offline-bundle") ||
    url.pathname.startsWith("/api/learn/progress");

  if (isSensitive) {
    // Explicitly go to network and stop other handlers seeing it.
    event.respondWith(fetch(event.request));
  }
});

serwist.addEventListeners();
