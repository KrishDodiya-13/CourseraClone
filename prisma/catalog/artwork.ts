import manifest from "../../public/images/courses/manifest.json";

/**
 * Course artwork assignment.
 *
 * The illustrations themselves are built by `scripts/build-thumbnails.mjs` and
 * committed to `public/images/courses/`. This module only decides which course
 * gets which one.
 *
 * The manifest is imported rather than globbed, so a missing file is a
 * build-time type error rather than a broken image in production. Nothing here
 * invents a path: every value returned came out of the generator.
 */

const ART: Record<string, string[]> = manifest;

/** Shown when a course has no artwork of its own. A real illustration, not a box. */
export const FALLBACK_ART = "/images/courses/fallback.svg";

/** The wide banner for a category page. */
export function bannerFor(categorySlug: string): string {
  return `/images/courses/_banners/${categorySlug}.svg`;
}

/**
 * Picks a course's thumbnail.
 *
 * Round-robin over the category's variants by the course's rank within that
 * category, not a hash of its slug. Hashing looked fine in aggregate and failed
 * where it mattered: slugs inside one category share word shapes, so collisions
 * clustered and three identical illustrations landed next to each other on the
 * category page. Round-robin bounds it — with `n` courses over `v` variants no
 * illustration is ever used more than `ceil(n / v)` times, and the spread is
 * even by construction.
 *
 * `rank` is the course's position in its category, sorted by slug, so the
 * assignment is stable across seeds and independent of insertion order.
 */
export function artworkFor(categorySlug: string, courseSlug: string, rank?: number): string {
  const options = ART[categorySlug];
  if (!options || options.length === 0) return FALLBACK_ART;

  const index = rank === undefined ? mix(courseSlug) % options.length : rank % options.length;
  return options[index] ?? FALLBACK_ART;
}

/**
 * Assigns artwork to a whole category at once.
 *
 * Returns a slug-to-path map. Callers that have the full set — the seed — should
 * use this rather than the single-course form, because the even spread only
 * exists when the ranks are computed together.
 */
export function artworkForCategory(
  categorySlug: string,
  courseSlugs: string[],
): Map<string, string> {
  const ordered = [...courseSlugs].sort();
  return new Map(ordered.map((slug, rank) => [slug, artworkFor(categorySlug, slug, rank)]));
}

/**
 * FNV-1a with an avalanche finish.
 *
 * A plain `hash * 31 + char` accumulator is not enough here: course slugs in one
 * category share prefixes and word shapes, so the low bits correlate and
 * `% variants` put three identical illustrations next to each other on the
 * catalogue page. The final mix decorrelates them.
 */
function mix(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Every artwork path the manifest knows about, for verification. */
export function allArtworkPaths(): string[] {
  return Object.values(ART).flat();
}
