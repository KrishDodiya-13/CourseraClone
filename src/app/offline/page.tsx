import type { Metadata } from "next";

import { OfflineReader } from "@/app/offline/offline-reader";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * Offline reading surface.
 *
 * Rendered statically with no server data of its own, which is what allows the
 * service worker to precache it and serve it when a navigation cannot reach
 * the network. Everything on the page comes from IndexedDB in the client.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return <OfflineReader />;
}
