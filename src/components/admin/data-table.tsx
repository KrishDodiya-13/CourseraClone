import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The console's table shell.
 *
 * A real `<table>`, not a grid of divs: an admin list is tabular data, and
 * screen readers announce row and column relationships for a table without
 * being told to. The horizontal scroll lives on the wrapper so a wide table
 * scrolls inside itself instead of pushing the page sideways.
 */
function DataTable({
  head,
  children,
  caption,
  className,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  /** Announced to screen readers; visually hidden. */
  caption: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-card", className)}>
      <table className="w-full min-w-[48rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left">{head}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 font-mono text-2xs font-medium tracking-wide text-muted-foreground uppercase",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <td className={cn("px-4 py-3 align-middle", align === "right" && "text-right", className)}>
      {children}
    </td>
  );
}

/** A full-width row for the "nothing matched" case, inside the table body. */
function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

export { DataTable, Th, Td, EmptyRow };
