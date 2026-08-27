"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCatalogUrl } from "@/features/catalog/use-catalog-url";

/**
 * Offset pagination, rendered as real links.
 *
 * Links rather than buttons on purpose: a page of results has a URL, so it
 * should be openable in a new tab, shareable, and crawlable. The click handler
 * intercepts to do a soft navigation, but the href is always correct without
 * JavaScript.
 *
 * Offset (not cursor) is right here because the catalogue is sorted by fields
 * a user chooses and needs jump-to-page. Cursor pagination lands where it
 * belongs — infinite feeds like notifications — in later phases.
 */
function CatalogPagination({
  page,
  pageCount,
  total,
  pageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const { searchParams, pathname, setParam } = useCatalogUrl();

  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (target > 1) next.set("page", String(target));
    else next.delete("page");
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const windowSize = 5;
  const start = Math.max(
    1,
    Math.min(page - Math.floor(windowSize / 2), pageCount - windowSize + 1),
  );
  const pages = Array.from(
    { length: Math.min(windowSize, pageCount) },
    (_, index) => start + index,
  ).filter((value) => value >= 1 && value <= pageCount);

  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center gap-3 border-t border-border pt-6"
    >
      <div className="flex items-center gap-1">
        <PageLink
          href={hrefFor(page - 1)}
          disabled={page <= 1}
          onNavigate={() => setParam("page", String(page - 1))}
          label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </PageLink>

        {start > 1 ? <Ellipsis /> : null}

        {pages.map((value) => (
          <PageLink
            key={value}
            href={hrefFor(value)}
            current={value === page}
            onNavigate={() => setParam("page", value > 1 ? String(value) : null)}
            label={`Page ${value}`}
          >
            <span data-numeric>{value}</span>
          </PageLink>
        ))}

        {start + pages.length - 1 < pageCount ? <Ellipsis /> : null}

        <PageLink
          href={hrefFor(page + 1)}
          disabled={page >= pageCount}
          onNavigate={() => setParam("page", String(page + 1))}
          label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </PageLink>
      </div>

      <p className="text-sm text-muted-foreground" data-numeric>
        Showing {firstResult}–{lastResult} of {total}
      </p>
    </nav>
  );
}

function Ellipsis() {
  return (
    <span className="px-2 text-sm text-muted-foreground" aria-hidden="true">
      …
    </span>
  );
}

function PageLink({
  href,
  children,
  current,
  disabled,
  onNavigate,
  label,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  onNavigate: () => void;
  label: string;
}) {
  const className = cn(
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-sm font-medium transition-colors",
    current
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    disabled && "pointer-events-none opacity-40",
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={className}
      onClick={(event) => {
        // Soft-navigate through the shared transition so the pending state is
        // consistent with the filters; the href stays valid regardless.
        event.preventDefault();
        onNavigate();
      }}
    >
      {children}
    </Link>
  );
}

export { CatalogPagination };
