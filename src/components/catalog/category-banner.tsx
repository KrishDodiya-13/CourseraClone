import Image from "next/image";

import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/catalog/category-icon";
import type { CategoryIconKey } from "@/features/catalog/types";

/**
 * The wide banner at the head of a category page.
 *
 * Drawn from the same generator as the course thumbnails, so a category and the
 * courses beneath it read as one family rather than two visual systems stacked
 * on top of each other.
 *
 * The artwork sits behind the text with a scrim, which is the only reason the
 * scrim exists: the illustrations are dark but their brightness varies by
 * palette, and the title has to stay legible over all of them.
 */
function CategoryBanner({
  name,
  description,
  slug,
  iconKey,
  courseCount,
  className,
}: {
  name: string;
  description: string;
  slug: string;
  iconKey: CategoryIconKey;
  courseCount: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-border",
        "min-h-44 sm:min-h-52",
        className,
      )}
    >
      <Image
        src={`/images/courses/_banners/${slug}.svg`}
        alt=""
        aria-hidden="true"
        fill
        // Above the fold on its own page, so it is not lazy.
        priority
        unoptimized
        sizes="(max-width: 1280px) 100vw, 1280px"
        className="object-cover"
      />

      {/* Left-weighted scrim: opaque where the text sits, clear where the
          illustration is worth seeing. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/10"
      />

      <div className="relative flex flex-col gap-2 p-6 sm:p-8">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-2xs font-medium text-white backdrop-blur-sm">
          <CategoryIcon iconKey={iconKey} className="size-3.5" />
          Category
        </span>

        <h1 className="text-3xl font-semibold text-white sm:text-4xl">{name}</h1>

        <p className="max-w-xl text-sm text-white/75 sm:text-base">{description}</p>

        <p className="text-sm font-medium text-white/90" data-numeric>
          {courseCount} course{courseCount === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

export { CategoryBanner };
