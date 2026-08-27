import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Course artwork.
 *
 * Every course has a real illustration — see `scripts/build-thumbnails.mjs` for
 * how they are drawn. The gradient-and-grid placeholder this component used to
 * render is gone: a coloured box says nothing about a course, and a wall of
 * them makes a catalogue look unfinished.
 *
 * The illustrations are SVG rather than WebP, deliberately. They are flat
 * geometric drawings, so a vector is both smaller (about 5 kB against 30-60 kB)
 * and sharper — exact on a high-density display and at the 1200px course hero,
 * from the same file the 300px card uses. Raster would win for photographs;
 * there are none here.
 *
 * `unoptimized` follows from that. Next's optimiser rasterises and generates a
 * srcset, which for a vector means producing something strictly worse than the
 * original at every size — and it would require `dangerouslyAllowSVG`, which
 * exists for a real reason. What `next/image` still contributes is the part
 * that matters: reserved space so nothing shifts as artwork loads, native lazy
 * loading below the fold, and decoding off the main thread.
 */

/** A real illustration, not a grey box, for a course whose artwork is missing. */
const FALLBACK = "/images/courses/fallback.svg";

function CourseThumbnail({
  title,
  src,
  className,
  priority = false,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
}: {
  /** Used for the alt text, so the artwork is described rather than announced. */
  title: string;
  src: string | null;
  className?: string;
  /** Set on above-the-fold artwork — the hero, the first row of a catalogue. */
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-muted", className)}>
      <Image
        src={src ?? FALLBACK}
        // The card already prints the title next to this, so a literal repeat
        // would make a screen reader say it twice. The artwork is decorative
        // relative to the heading beside it.
        alt=""
        aria-hidden="true"
        fill
        sizes={sizes}
        unoptimized
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="object-cover"
      />
      <span className="sr-only">{title}</span>
    </div>
  );
}

export { CourseThumbnail, FALLBACK as FALLBACK_THUMBNAIL };
