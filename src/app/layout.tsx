import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "@/styles/globals.css";

import { cn } from "@/lib/utils";
import { getViewer, getViewerNotifications } from "@/features/viewer/get-viewer";
import { ViewerProvider } from "@/features/viewer/context";
import { getCategories } from "@/features/catalog/queries";
import { Providers } from "@/components/layout/theme-provider";
import Script from "next/script";

import { colorThemeScript } from "@/components/layout/color-theme";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/toast";
import { OfflineProvider } from "@/components/offline/offline-provider";

/** Display face — headings and figures only, where its character reads. */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

/** UI and body face — everything else. */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

/** Data, labels and code. */
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Coursera — learn something that sticks",
    template: "%s · Coursera",
  },
  description:
    "Coursera is a learning platform for people who finish what they start: structured courses, honest progress tracking, and credentials worth showing.",
  applicationName: "Coursera",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfdfc" },
    { media: "(prefers-color-scheme: dark)", color: "#111917" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Resolved on the server. Phase 4 makes these real; the shape does not change.
  const viewer = await getViewer();
  const notifications = await getViewerNotifications(viewer);

  // Navigation categories, straight from the database.
  const categories = await getCategories();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          bricolage.variable,
          jakarta.variable,
          jetbrains.variable,
          "min-h-dvh antialiased",
        )}
      >
        {/* Applies the stored colour theme before the page paints.
            `next/script` with `beforeInteractive` rather than a raw <script>:
            Next hoists it out of the body, so it does not take part in body
            hydration. A hand-rolled inline script here — and equally a manual
            <head> wrapper — made React re-render the whole body subtree,
            leaving two copies of every form in the DOM. */}
        <Script id="lumen-color-theme" strategy="beforeInteractive">
          {colorThemeScript}
        </Script>

        <Providers>
          <ViewerProvider viewer={viewer} notifications={notifications}>
            <OfflineProvider>
              <a
                href="#main"
                className="sr-only-focusable absolute top-3 left-3 z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Skip to content
              </a>
              <div className="flex min-h-dvh flex-col">
                <SiteHeader categories={categories} />
                <main id="main" className="flex-1">
                  {children}
                </main>
                <SiteFooter categories={categories} />
              </div>
              <Toaster />
            </OfflineProvider>
          </ViewerProvider>
        </Providers>
      </body>
    </html>
  );
}
