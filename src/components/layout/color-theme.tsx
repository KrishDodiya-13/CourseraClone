"use client";

import * as React from "react";

/**
 * Colour theme — the platform's visual identity, chosen by the viewer.
 *
 * This is a separate axis from light/dark. Appearance answers "how bright",
 * identity answers "which palette"; the two compose, so there are four real
 * combinations and neither control has to know about the other.
 *
 * Implementation is one attribute on `<html>`. Every token block in
 * `globals.css` keys off `[data-theme]`, and every component reads the
 * semantic tokens — so switching identity repaints the whole product without
 * a single component knowing a theme exists. That is the entire point: no
 * duplicated components, no theme-specific class names in the tree.
 */

export const COLOR_THEMES = [
  {
    value: "coursera",
    label: "Coursera Blue",
    description: "The client's reference palette",
    // Swatches are literal on purpose — they *depict* a palette rather than
    // participate in one, so they must not move when the palette changes.
    swatch: ["oklch(0.493 0.204 260.2)", "oklch(0.784 0.159 73)", "oklch(0.918 0.002 247.8)"],
  },
  {
    value: "indigo",
    label: "Modern Indigo",
    description: "Academic and professional",
    swatch: ["oklch(0.505 0.176 274)", "oklch(0.755 0.142 68)", "oklch(0.906 0.009 268)"],
  },
  {
    value: "emerald",
    label: "Emerald Learning",
    description: "Fresh and focused",
    swatch: ["oklch(0.548 0.132 162)", "oklch(0.585 0.108 218)", "oklch(0.905 0.012 164)"],
  },
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number]["value"];

export const DEFAULT_COLOR_THEME: ColorTheme = "coursera";
const STORAGE_KEY = "lumen-color-theme";

function isColorTheme(value: unknown): value is ColorTheme {
  return COLOR_THEMES.some((theme) => theme.value === value);
}

/**
 * The script that runs before first paint.
 *
 * Without it the document renders in the default palette and then snaps to the
 * stored one — the same flash `next-themes` exists to prevent for light/dark,
 * for the same reason. It is deliberately tiny and dependency-free because it
 * runs blocking, ahead of everything.
 */
export const colorThemeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t!=="coursera"&&t!=="indigo"&&t!=="emerald"){t=${JSON.stringify(
  DEFAULT_COLOR_THEME,
)}}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme",${JSON.stringify(
  DEFAULT_COLOR_THEME,
)})}})();`;

interface ColorThemeContextValue {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  /** False until the stored value has been read, so controls can avoid a mismatch. */
  mounted: boolean;
}

const ColorThemeContext = React.createContext<ColorThemeContextValue | null>(null);

function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setState] = React.useState<ColorTheme>(DEFAULT_COLOR_THEME);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // The blocking script already applied the attribute; this only syncs React
    // state to what the document is actually showing.
    const attr = document.documentElement.getAttribute("data-theme");
    if (isColorTheme(attr)) setState(attr);
    setMounted(true);
  }, []);

  const setColorTheme = React.useCallback((next: ColorTheme) => {
    setState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing, or site data blocked. The choice still applies for
      // this page view; it simply will not be remembered.
    }
  }, []);

  const value = React.useMemo(
    () => ({ colorTheme, setColorTheme, mounted }),
    [colorTheme, setColorTheme, mounted],
  );

  return <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>;
}

function useColorTheme(): ColorThemeContextValue {
  const context = React.useContext(ColorThemeContext);
  if (!context) {
    throw new Error("useColorTheme must be used inside ColorThemeProvider");
  }
  return context;
}

export { ColorThemeProvider, useColorTheme };
