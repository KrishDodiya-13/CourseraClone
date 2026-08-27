"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ColorThemeProvider } from "@/components/layout/color-theme";

/**
 * Client-side providers mounted once at the root. Kept in one component so the
 * root layout stays a server component.
 */
function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ColorThemeProvider>
        <TooltipProvider delayDuration={250} skipDelayDuration={300}>
          {children}
        </TooltipProvider>
      </ColorThemeProvider>
    </NextThemesProvider>
  );
}

export { Providers };
