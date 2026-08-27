"use client";

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogFacets } from "@/features/catalog/queries";
import { useCatalogUrl } from "@/features/catalog/use-catalog-url";
import {
  DURATION_OPTIONS,
  LANGUAGE_LABELS,
  LEVEL_OPTIONS,
  PRICE_OPTIONS,
  RATING_OPTIONS,
  SORT_OPTIONS,
  type CatalogParams,
} from "@/features/catalog/search-params";

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                           */
/* -------------------------------------------------------------------------- */

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="pb-1 font-mono text-2xs tracking-wide text-muted-foreground uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function CheckboxRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 rounded border-input accent-primary"
      />
      <span className="flex-1 text-foreground">{label}</span>
      {count === undefined ? null : (
        <span className="font-mono text-2xs text-muted-foreground" data-numeric>
          {count}
        </span>
      )}
    </label>
  );
}

function RadioRow({
  label,
  checked,
  onChange,
  name,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  name: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-primary"
      />
      <span className="text-foreground">{label}</span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*  Filter panel                                                              */
/* -------------------------------------------------------------------------- */

function FilterPanel({
  facets,
  hideCategory = false,
}: {
  facets: CatalogFacets;
  /** Category pages fix the category, so the control is redundant there. */
  hideCategory?: boolean;
}) {
  const { get, getAll, setParam, toggleParam } = useCatalogUrl();

  const activeCategory = get("category");
  const activeTags = getAll("tag");
  const activeLevels = getAll("level");
  const activeLanguages = getAll("language");
  const activeDurations = getAll("duration");
  const activePrice = get("price") || "all";
  const activeRating = get("rating") || "0";

  return (
    <div className="flex flex-col gap-6">
      {hideCategory ? null : (
        <>
          <FilterGroup title="Category">
            {facets.categories.map((category) => (
              <CheckboxRow
                key={category.slug}
                label={category.name}
                count={category.count}
                checked={activeCategory === category.slug}
                onChange={() =>
                  setParam("category", activeCategory === category.slug ? null : category.slug)
                }
              />
            ))}
          </FilterGroup>
          <Separator />
        </>
      )}

      <FilterGroup title="Level">
        {LEVEL_OPTIONS.map((level) => (
          <CheckboxRow
            key={level.value}
            label={level.label}
            checked={activeLevels.includes(level.value)}
            onChange={() => toggleParam("level", level.value)}
          />
        ))}
      </FilterGroup>

      <Separator />

      <FilterGroup title="Price">
        {PRICE_OPTIONS.map((price) => (
          <RadioRow
            key={price.value}
            name="price"
            label={price.label}
            checked={activePrice === price.value}
            onChange={() => setParam("price", price.value === "all" ? null : price.value)}
          />
        ))}
      </FilterGroup>

      <Separator />

      <FilterGroup title="Rating">
        {RATING_OPTIONS.map((rating) => (
          <RadioRow
            key={rating.value}
            name="rating"
            label={rating.label}
            checked={Number(activeRating) === rating.value}
            onChange={() => setParam("rating", rating.value ? String(rating.value) : null)}
          />
        ))}
      </FilterGroup>

      <Separator />

      <FilterGroup title="Duration">
        {DURATION_OPTIONS.map((duration) => (
          <CheckboxRow
            key={duration.value}
            label={duration.label}
            checked={activeDurations.includes(duration.value)}
            onChange={() => toggleParam("duration", duration.value)}
          />
        ))}
      </FilterGroup>

      {facets.languages.length > 1 ? (
        <>
          <Separator />
          <FilterGroup title="Language">
            {facets.languages.map((language) => (
              <CheckboxRow
                key={language.code}
                label={LANGUAGE_LABELS[language.code] ?? language.code.toUpperCase()}
                count={language.count}
                checked={activeLanguages.includes(language.code)}
                onChange={() => toggleParam("language", language.code)}
              />
            ))}
          </FilterGroup>
        </>
      ) : null}

      {facets.tags.length > 0 ? (
        <>
          <Separator />
          <FilterGroup title="Topics">
            <div className="flex flex-wrap gap-1.5">
              {facets.tags.slice(0, 18).map((tag) => {
                const active = activeTags.includes(tag.slug);
                return (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => toggleParam("tag", tag.slug)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </FilterGroup>
        </>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sidebar, mobile sheet, sort, and active chips                             */
/* -------------------------------------------------------------------------- */

function CatalogFilterSidebar({
  facets,
  hideCategory,
}: {
  facets: CatalogFacets;
  hideCategory?: boolean;
}) {
  return (
    <aside aria-label="Filters" className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-20">
        <FilterPanel facets={facets} hideCategory={hideCategory} />
      </div>
    </aside>
  );
}

function CatalogFilterSheet({
  facets,
  hideCategory,
  activeCount,
}: {
  facets: CatalogFacets;
  hideCategory?: boolean;
  activeCount: number;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant="outline" className="lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal aria-hidden="true" />
        Filters
        {activeCount > 0 ? (
          <Badge variant="primary" size="sm">
            {activeCount}
          </Badge>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[min(22rem,90vw)] p-0">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <FilterPanel facets={facets} hideCategory={hideCategory} />
          </div>
          <div className="sticky bottom-0 border-t border-border bg-popover p-4">
            <Button fullWidth onClick={() => setOpen(false)}>
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CatalogSort({ hasQuery }: { hasQuery: boolean }) {
  const { get, setParam } = useCatalogUrl();
  const current = get("sort") || "relevance";

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="catalog-sort" className="sr-only">
        Sort results
      </label>
      <Select value={current} onValueChange={(value) => setParam("sort", value)}>
        <SelectTrigger id="catalog-sort" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {/* Relevance needs something to be relevant to. */}
              {option.value === "relevance" && !hasQuery ? "Default" : option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Removable chips summarising what is currently narrowing the results. */
function ActiveFilterChips({ params, facets }: { params: CatalogParams; facets: CatalogFacets }) {
  const { setParam, toggleParam, clearAll } = useCatalogUrl();

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (params.q) {
    chips.push({ key: `q`, label: `“${params.q}”`, onRemove: () => setParam("q", null) });
  }

  if (params.category) {
    const category = facets.categories.find((entry) => entry.slug === params.category);
    chips.push({
      key: `category`,
      label: category?.name ?? params.category,
      onRemove: () => setParam("category", null),
    });
  }

  for (const level of params.level) {
    const option = LEVEL_OPTIONS.find((entry) => entry.value === level);
    chips.push({
      key: `level-${level}`,
      label: option?.label ?? level,
      onRemove: () => toggleParam("level", level),
    });
  }

  for (const tag of params.tag) {
    const facet = facets.tags.find((entry) => entry.slug === tag);
    chips.push({
      key: `tag-${tag}`,
      label: facet?.name ?? tag,
      onRemove: () => toggleParam("tag", tag),
    });
  }

  for (const language of params.language) {
    chips.push({
      key: `language-${language}`,
      label: LANGUAGE_LABELS[language] ?? language.toUpperCase(),
      onRemove: () => toggleParam("language", language),
    });
  }

  for (const duration of params.duration) {
    const option = DURATION_OPTIONS.find((entry) => entry.value === duration);
    chips.push({
      key: `duration-${duration}`,
      label: option?.label ?? duration,
      onRemove: () => toggleParam("duration", duration),
    });
  }

  if (params.price !== "all") {
    const option = PRICE_OPTIONS.find((entry) => entry.value === params.price);
    chips.push({
      key: `price`,
      label: option?.label ?? params.price,
      onRemove: () => setParam("price", null),
    });
  }

  if (params.rating > 0) {
    chips.push({
      key: `rating`,
      label: `${params.rating}+ rating`,
      onRemove: () => setParam("rating", null),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs transition-colors hover:border-danger/40 hover:text-danger"
        >
          {chip.label}
          <X className="size-3" aria-hidden="true" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="text-xs font-medium text-primary hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

export { CatalogFilterSidebar, CatalogFilterSheet, CatalogSort, ActiveFilterChips, FilterPanel };
