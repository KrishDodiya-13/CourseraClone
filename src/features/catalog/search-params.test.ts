import { describe, expect, it } from "vitest";

import {
  buildCatalogQuery,
  effectiveSort,
  hasActiveFilters,
  parseCatalogParams,
} from "@/features/catalog/search-params";

describe("parseCatalogParams", () => {
  it("returns usable defaults for an empty query string", () => {
    const params = parseCatalogParams({});
    expect(params).toMatchObject({
      q: "",
      category: "",
      tag: [],
      level: [],
      price: "all",
      rating: 0,
      sort: "relevance",
      page: 1,
    });
  });

  it("accepts repeated parameters and comma-separated lists alike", () => {
    expect(parseCatalogParams({ tag: ["a", "b"] }).tag).toEqual(["a", "b"]);
    expect(parseCatalogParams({ tag: "a,b" }).tag).toEqual(["a", "b"]);
    expect(parseCatalogParams({ tag: " a , b " }).tag).toEqual(["a", "b"]);
  });

  it("uppercases levels and drops ones that are not real", () => {
    const params = parseCatalogParams({ level: ["beginner", "not-a-level", "ADVANCED"] });
    expect(params.level).toEqual(["BEGINNER", "ADVANCED"]);
  });

  it("falls back rather than throwing on a hand-mangled URL", () => {
    // A bad query string should degrade to the default view, never a 500.
    const params = parseCatalogParams({
      sort: "by-vibes",
      price: "negotiable",
      rating: "not-a-number",
      page: "-4",
    });
    expect(params.sort).toBe("relevance");
    expect(params.price).toBe("all");
    expect(params.rating).toBe(0);
    expect(params.page).toBe(1);
  });

  it("clamps rating and page to sane bounds", () => {
    expect(parseCatalogParams({ rating: "9" }).rating).toBe(5);
    expect(parseCatalogParams({ page: "99999" }).page).toBe(500);
  });

  it("trims and length-caps the query", () => {
    expect(parseCatalogParams({ q: "  python  " }).q).toBe("python");
    expect(parseCatalogParams({ q: "x".repeat(500) }).q).toHaveLength(120);
  });
});

describe("effectiveSort", () => {
  it("keeps relevance when there is a query to rank against", () => {
    expect(effectiveSort(parseCatalogParams({ q: "python" }))).toBe("relevance");
  });

  it("falls back to popularity when there is no query", () => {
    // Ranking by relevance with nothing to be relevant to is meaningless.
    expect(effectiveSort(parseCatalogParams({}))).toBe("popular");
  });

  it("leaves an explicit sort alone", () => {
    expect(effectiveSort(parseCatalogParams({ sort: "price-asc" }))).toBe("price-asc");
  });
});

describe("hasActiveFilters", () => {
  it("is false for a bare catalogue view", () => {
    expect(hasActiveFilters(parseCatalogParams({}))).toBe(false);
  });

  it("is false when only sort or page changed", () => {
    // Neither narrows the result set, so neither should show a clearable chip.
    expect(hasActiveFilters(parseCatalogParams({ sort: "newest", page: "3" }))).toBe(false);
  });

  it("is true for any narrowing filter", () => {
    expect(hasActiveFilters(parseCatalogParams({ q: "python" }))).toBe(true);
    expect(hasActiveFilters(parseCatalogParams({ tag: "css" }))).toBe(true);
    expect(hasActiveFilters(parseCatalogParams({ price: "free" }))).toBe(true);
    expect(hasActiveFilters(parseCatalogParams({ rating: "4" }))).toBe(true);
  });
});

describe("buildCatalogQuery", () => {
  it("omits defaults so a clean view has a clean URL", () => {
    expect(buildCatalogQuery(parseCatalogParams({}))).toBe("");
    expect(buildCatalogQuery(parseCatalogParams({ sort: "relevance", page: "1" }))).toBe("");
  });

  it("round-trips through parse without losing anything", () => {
    const original = parseCatalogParams({
      q: "python",
      tag: ["programming", "data"],
      level: ["BEGINNER"],
      price: "free",
      rating: "4",
      sort: "newest",
      page: "2",
    });

    const query = buildCatalogQuery(original);
    const reparsed = parseCatalogParams(
      Object.fromEntries(
        Array.from(new URLSearchParams(query.slice(1)).keys()).map((key) => [
          key,
          new URLSearchParams(query.slice(1)).getAll(key),
        ]),
      ),
    );

    expect(reparsed.q).toBe(original.q);
    expect(reparsed.tag).toEqual(original.tag);
    expect(reparsed.level).toEqual(original.level);
    expect(reparsed.price).toBe(original.price);
    expect(reparsed.rating).toBe(original.rating);
    expect(reparsed.sort).toBe(original.sort);
    expect(reparsed.page).toBe(original.page);
  });

  it("applies overrides on top of existing params", () => {
    const params = parseCatalogParams({ q: "python", page: "3" });
    expect(buildCatalogQuery(params, { page: 1 })).toBe("?q=python");
  });
});

describe("duplicated single-value parameters", () => {
  it("takes the first value instead of discarding every other filter", () => {
    // A duplicated key used to fail the whole parse, which silently reset the
    // rest of the URL to defaults.
    const params = parseCatalogParams({
      q: ["python", "rust"],
      price: ["free", "under-999"],
      tag: ["programming"],
    });

    expect(params.q).toBe("python");
    expect(params.price).toBe("free");
    expect(params.tag).toEqual(["programming"]);
  });
});
