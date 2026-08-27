"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Reads and writes catalogue state through the URL.
 *
 * All discovery state lives in the query string, so this hook is the only
 * writer. Two behaviours matter:
 *
 *  - `router.replace` with `scroll: false`, so filtering does not push a
 *    history entry per checkbox and does not jump the page to the top;
 *  - any change to a filter resets `page` to 1, because staying on page 4 of
 *    a result set that just shrank to two pages shows an empty grid.
 *
 * Navigation is wrapped in a transition so the caller can render a pending
 * state while the server re-renders, instead of the UI freezing.
 */
export function useCatalogUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const commit = React.useCallback(
    (next: URLSearchParams) => {
      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  /** Replaces a single-valued parameter. Empty string removes it. */
  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      commit(next);
    },
    [commit, searchParams],
  );

  /** Adds or removes one value of a repeated parameter. */
  const toggleParam = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      const current = next.getAll(key);
      next.delete(key);
      const updated = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      for (const entry of updated) next.append(key, entry);
      next.delete("page");
      commit(next);
    },
    [commit, searchParams],
  );

  const clearAll = React.useCallback(() => {
    commit(new URLSearchParams());
  }, [commit]);

  const getAll = React.useCallback((key: string) => searchParams.getAll(key), [searchParams]);

  const get = React.useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  return { get, getAll, setParam, toggleParam, clearAll, isPending, searchParams, pathname };
}

/**
 * Debounces a value so typing does not fire a request per keystroke.
 *
 * 350ms is the deliberate figure: short enough that the results feel tied to
 * the typing, long enough that an average typist produces one request per word
 * rather than one per letter.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
