import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Route group for the auth screens. They share the site chrome from the root
 * layout but are excluded from search indexing.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
