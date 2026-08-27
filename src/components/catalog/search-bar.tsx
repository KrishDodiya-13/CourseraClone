"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";

/**
 * Catalogue search. One component, used at two scales: compact in the navbar,
 * prominent in the hero.
 *
 * It is a real `<form>` with a real submit, so Enter works and the browser
 * treats it as search. It navigates to the catalogue with the query in the URL
 * — which is where Phase 5 will read it from, meaning the search box itself
 * needs no further work once the results page exists.
 */
function SearchBar({
  size = "sm",
  defaultValue = "",
  autoFocus = false,
  className,
  onSubmitted,
  id = "course-search",
}: {
  size?: "sm" | "lg";
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
  /** Called after a successful submit — used to close the mobile drawer. */
  onSubmitted?: () => void;
  id?: string;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultValue);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    router.push(routes.search(query));
    onSubmitted?.();
  }

  const large = size === "lg";

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn("relative flex w-full items-center", className)}
    >
      <label htmlFor={id} className="sr-only">
        Search courses
      </label>
      <Search
        className={cn(
          "pointer-events-none absolute left-3.5 text-muted-foreground",
          large ? "size-5" : "size-4",
        )}
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        name="q"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        placeholder={large ? "What do you want to learn?" : "Search courses"}
        className={cn(
          "w-full rounded-full border border-input bg-card text-foreground shadow-xs",
          "transition-[border-color,box-shadow] placeholder:text-muted-foreground/70",
          "[&::-webkit-search-cancel-button]:appearance-none",
          large ? "h-14 pr-32 pl-11 text-base" : "h-9.5 pr-3 pl-9 text-sm",
        )}
      />
      {large ? (
        <Button type="submit" size="md" className="absolute right-2 rounded-full px-5">
          Search
        </Button>
      ) : (
        <button type="submit" className="sr-only">
          Search
        </button>
      )}
    </form>
  );
}

export { SearchBar };
