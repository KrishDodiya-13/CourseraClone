"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COLOR_THEMES, useColorTheme, type ColorTheme } from "@/components/layout/color-theme";

const APPEARANCES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Appearance and identity, in one menu.
 *
 * Two groups rather than one flat list, because they answer different
 * questions — how bright the interface is, and which palette it wears. Merging
 * them into six options would imply they are alternatives to each other, which
 * they are not: every appearance works with every colour theme.
 *
 * The colour themes are shown as swatch rows rather than named radio items.
 * A palette is a visual thing; asking someone to pick one from words alone
 * makes them switch to find out what they chose.
 */
function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme, mounted } = useColorTheme();

  const [appearanceMounted, setAppearanceMounted] = React.useState(false);
  React.useEffect(() => setAppearanceMounted(true), []);

  const ActiveIcon =
    appearanceMounted && theme === "dark"
      ? Moon
      : appearanceMounted && theme === "light"
        ? Sun
        : Palette;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Appearance and colour theme"
          className={className}
        >
          <ActiveIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60 p-1.5">
        <DropdownMenuLabel className="px-2 pt-1.5 pb-1">Appearance</DropdownMenuLabel>

        {/* A segmented control, not three menu rows: the options are mutually
            exclusive and comparable, so they read better side by side. */}
        <div
          role="radiogroup"
          aria-label="Appearance"
          className="mx-1 mb-2 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
        >
          {APPEARANCES.map(({ value, label, icon: Icon }) => {
            const active = appearanceMounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-2xs font-medium transition-colors",
                  active
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="px-2 pt-1.5 pb-1">Colour theme</DropdownMenuLabel>

        <div
          role="radiogroup"
          aria-label="Colour theme"
          className="flex flex-col gap-0.5 px-1 pb-1"
        >
          {COLOR_THEMES.map((entry) => {
            const active = mounted && colorTheme === entry.value;
            return (
              <button
                key={entry.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setColorTheme(entry.value as ColorTheme)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                  active ? "bg-primary-subtle" : "hover:bg-secondary",
                )}
              >
                <span aria-hidden="true" className="flex shrink-0 -space-x-1">
                  {entry.swatch.map((color, index) => (
                    <span
                      key={index}
                      className="size-4 rounded-full ring-2 ring-popover"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      active ? "text-primary-subtle-foreground" : "text-foreground",
                    )}
                  >
                    {entry.label}
                  </span>
                  <span className="truncate text-2xs text-muted-foreground">
                    {entry.description}
                  </span>
                </span>

                {active ? (
                  <Check
                    className="size-4 shrink-0 text-primary-subtle-foreground"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ThemeToggle };
