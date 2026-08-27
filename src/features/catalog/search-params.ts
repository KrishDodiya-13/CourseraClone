import { z } from "zod";

/**
 * The catalogue's URL contract.
 *
 * Every piece of discovery state — query, facets, sort, page — lives in the
 * URL and nowhere else. That is what makes a filtered result shareable,
 * bookmarkable, and survivable across a refresh or a back button, and it is
 * why there is no client-side filter store anywhere in this feature.
 *
 * Parsing is permissive by design: an unknown sort or a malformed page number
 * falls back to the default rather than erroring. A hand-edited URL should
 * degrade to something sensible, not to a 500.
 */

export const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const LEVEL_OPTIONS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "ALL_LEVELS", label: "All levels" },
] as const;

/**
 * Price bands, in rupees.
 *
 * The thresholds are as important as the labels. These were dollar bands
 * (under $50 / $50-100 / over $100) whose paise equivalents were ₹50 and ₹100 —
 * which put the entire ₹499-₹7,999 catalogue in one bucket and made the filter
 * useless. The bands below split the real catalogue roughly evenly.
 */
export const PRICE_OPTIONS = [
  { value: "all", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "under-999", label: "Under ₹999" },
  { value: "999-2499", label: "₹999 – ₹2,499" },
  { value: "2500-4999", label: "₹2,500 – ₹4,999" },
  { value: "over-5000", label: "₹5,000 and above" },
] as const;

export type PriceOption = (typeof PRICE_OPTIONS)[number]["value"];

export const DURATION_OPTIONS = [
  { value: "short", label: "Under 4 hours", minMinutes: 0, maxMinutes: 240 },
  { value: "medium", label: "4 to 10 hours", minMinutes: 240, maxMinutes: 600 },
  { value: "long", label: "Over 10 hours", minMinutes: 600, maxMinutes: null },
] as const;

export type DurationOption = (typeof DURATION_OPTIONS)[number]["value"];

export const RATING_OPTIONS = [
  { value: 0, label: "Any rating" },
  { value: 3, label: "3.0 and up" },
  { value: 4, label: "4.0 and up" },
  { value: 4.5, label: "4.5 and up" },
] as const;

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  hi: "Hindi",
  ja: "Japanese",
  pt: "Portuguese",
};

export const PAGE_SIZE = 12;

/**
 * Single-valued parameters, tolerant of duplication.
 *
 * `?q=a&q=b` arrives as an array. Without this the whole parse would fail and
 * fall back to defaults, silently dropping every *other* filter in the URL —
 * so a duplicated key takes the first value rather than poisoning the request.
 */
const singleValue = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? "")));

/** Accepts `?tag=a&tag=b` and `?tag=a,b` alike. */
const multiValue = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
  });

export const catalogParamsSchema = z.object({
  q: singleValue.transform((value) => value.trim().slice(0, 120)),
  category: singleValue.transform((value) => value.trim()),
  tag: multiValue,
  level: multiValue.transform((values) =>
    values
      .map((value) => value.toUpperCase())
      .filter((value): value is (typeof LEVEL_OPTIONS)[number]["value"] =>
        LEVEL_OPTIONS.some((option) => option.value === value),
      ),
  ),
  language: multiValue.transform((values) => values.map((value) => value.toLowerCase())),
  duration: multiValue.transform((values) =>
    values.filter((value): value is DurationOption =>
      DURATION_OPTIONS.some((option) => option.value === value),
    ),
  ),
  price: singleValue.transform((value): PriceOption =>
    PRICE_OPTIONS.some((option) => option.value === value) ? (value as PriceOption) : "all",
  ),
  rating: singleValue.transform((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 5) : 0;
  }),
  sort: singleValue.transform((value): SortOption =>
    SORT_OPTIONS.some((option) => option.value === value) ? (value as SortOption) : "relevance",
  ),
  page: singleValue.transform((value) => {
    const parsed = Number.parseInt(value || "1", 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 1;
  }),
});

export type CatalogParams = z.infer<typeof catalogParamsSchema>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseCatalogParams(input: RawSearchParams): CatalogParams {
  const result = catalogParamsSchema.safeParse(input);
  if (result.success) return result.data;
  // Unreachable in practice — every field has a fallback — but a catalogue
  // page should never 500 because someone mangled a query string.
  return catalogParamsSchema.parse({});
}

/**
 * Relevance only means something when there is a query to be relevant to.
 * Without one it silently becomes "most popular", which is what a browsing
 * user actually wants from an unsorted catalogue.
 */
export function effectiveSort(params: CatalogParams): Exclude<SortOption, "relevance"> {
  if (params.sort === "relevance") return params.q ? ("relevance" as never) : "popular";
  return params.sort;
}

export function hasActiveFilters(params: CatalogParams): boolean {
  return Boolean(
    params.q ||
    params.category ||
    params.tag.length ||
    params.level.length ||
    params.language.length ||
    params.duration.length ||
    params.price !== "all" ||
    params.rating > 0,
  );
}

/** Serialises params back to a query string, dropping defaults. */
export function buildCatalogQuery(
  params: Partial<CatalogParams>,
  overrides: Partial<CatalogParams> = {},
): string {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();

  if (merged.q) search.set("q", merged.q);
  if (merged.category) search.set("category", merged.category);
  for (const tag of merged.tag ?? []) search.append("tag", tag);
  for (const level of merged.level ?? []) search.append("level", level);
  for (const language of merged.language ?? []) search.append("language", language);
  for (const duration of merged.duration ?? []) search.append("duration", duration);
  if (merged.price && merged.price !== "all") search.set("price", merged.price);
  if (merged.rating) search.set("rating", String(merged.rating));
  if (merged.sort && merged.sort !== "relevance") search.set("sort", merged.sort);
  if (merged.page && merged.page > 1) search.set("page", String(merged.page));

  const query = search.toString();
  return query ? `?${query}` : "";
}
