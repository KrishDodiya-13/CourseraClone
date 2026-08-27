"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useCatalogUrl, useDebouncedValue } from "@/features/catalog/use-catalog-url";

/**
 * Console search box.
 *
 * The same debounce rule as the catalogue, for the same reason: the field
 * updates on every keystroke so typing stays responsive, but the URL — and
 * therefore the query — only changes once typing stops. An admin scanning a
 * user list should not generate one database round trip per letter.
 */
function AdminSearch({ placeholder, label }: { placeholder: string; label: string }) {
  const { get, setParam, isPending } = useCatalogUrl();
  const urlQuery = get("q");

  const [value, setValue] = React.useState(urlQuery);
  const debounced = useDebouncedValue(value, 350);
  const hasMounted = React.useRef(false);

  React.useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (debounced.trim() === urlQuery.trim()) return;
    setParam("q", debounced.trim() || null);
  }, [debounced, urlQuery, setParam]);

  return (
    <div className="relative w-full sm:max-w-sm">
      <label htmlFor="admin-search" className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id="admin-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            setParam("q", value.trim() || null);
          }
        }}
        placeholder={placeholder}
        className="pr-16 pl-9"
      />
      <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1">
        {isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : null}
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setParam("q", null);
            }}
            aria-label="Clear search"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * A row of mutually exclusive filter chips backed by one URL parameter.
 *
 * Buttons rather than a `<select>`: the counts are part of the information, and
 * an admin deciding what to look at wants to see "12 in review" before
 * clicking, not after.
 */
function AdminFilterChips({
  param,
  options,
  allLabel = "All",
  allCount,
}: {
  param: string;
  options: FilterOption[];
  allLabel?: string;
  allCount?: number;
}) {
  const { get, setParam } = useCatalogUrl();
  const active = get(param);

  const chips: FilterOption[] = [{ value: "", label: allLabel, count: allCount }, ...options];

  return (
    <div role="group" aria-label={`Filter by ${param}`} className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const selected = active === chip.value;
        return (
          <button
            key={chip.value || "all"}
            type="button"
            aria-pressed={selected}
            onClick={() => setParam(param, chip.value || null)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {chip.label}
            {chip.count !== undefined ? (
              <span className="font-mono text-2xs text-muted-foreground" data-numeric>
                {chip.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Offset pagination for console lists.
 *
 * Rendered as real links so a page of results can be opened in a new tab or
 * bookmarked, with a soft navigation intercepting the click.
 */
function AdminPagination({
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

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-sm text-muted-foreground">
        <span data-numeric>
          {first}–{last}
        </span>{" "}
        of <span data-numeric>{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <Link
          href={hrefFor(page - 1)}
          onClick={(event) => {
            event.preventDefault();
            setParam("page", page - 1 > 1 ? String(page - 1) : null);
          }}
          aria-disabled={page <= 1}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm",
            page <= 1
              ? "pointer-events-none text-muted-foreground opacity-50"
              : "hover:bg-secondary",
          )}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Link>

        <span className="px-2 text-sm text-muted-foreground">
          Page <span data-numeric>{page}</span> of <span data-numeric>{pageCount}</span>
        </span>

        <Link
          href={hrefFor(page + 1)}
          onClick={(event) => {
            event.preventDefault();
            setParam("page", String(page + 1));
          }}
          aria-disabled={page >= pageCount}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm",
            page >= pageCount
              ? "pointer-events-none text-muted-foreground opacity-50"
              : "hover:bg-secondary",
          )}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}

export { AdminSearch, AdminFilterChips, AdminPagination };
