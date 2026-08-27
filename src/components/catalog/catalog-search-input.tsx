"use client";

import * as React from "react";
import { Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useCatalogUrl, useDebouncedValue } from "@/features/catalog/use-catalog-url";

/**
 * Live catalogue search.
 *
 * The debounce is the whole point: the input updates on every keystroke so
 * typing stays responsive, but the URL — and therefore the database query —
 * only changes 350ms after typing stops.
 *
 * Two further guards stop wasted requests:
 *  - the committed value is compared against what is already in the URL, so
 *    typing a letter and deleting it fires nothing;
 *  - the first render is skipped, so arriving with `?q=` in the URL does not
 *    immediately rewrite the same URL back.
 */
function CatalogSearchInput({
  placeholder = "Search courses, topics or instructors",
  autoFocus = false,
  className,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const { get, setParam, isPending } = useCatalogUrl();
  const urlQuery = get("q");

  const [value, setValue] = React.useState(urlQuery);
  const debounced = useDebouncedValue(value, 350);
  const hasMounted = React.useRef(false);

  // Keep in step when the URL changes from elsewhere (a tag chip being
  // cleared, the back button, a link into the page with a query).
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
    <div className={cn("relative w-full", className)}>
      <label htmlFor="catalog-search" className="sr-only">
        Search courses
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id="catalog-search"
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Enter commits immediately rather than waiting out the debounce.
          if (event.key === "Enter") {
            event.preventDefault();
            setParam("q", value.trim() || null);
          }
        }}
        placeholder={placeholder}
        className="h-11 rounded-full pr-20 pl-10 text-base"
        aria-describedby="catalog-search-status"
      />

      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1">
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
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <span id="catalog-search-status" className="sr-only" role="status" aria-live="polite">
        {isPending ? "Updating results" : ""}
      </span>
    </div>
  );
}

export { CatalogSearchInput };
