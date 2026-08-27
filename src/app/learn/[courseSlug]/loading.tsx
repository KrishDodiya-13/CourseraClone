import { Skeleton } from "@/components/ui/skeleton";

/**
 * Learning shell skeleton.
 *
 * This page is the heaviest in the product — course, sections, lessons,
 * progress, quiz and assignment state all resolve before it can render — so it
 * is the one that most needs a shape to land on. The two-column split is drawn
 * here exactly as the real shell draws it, so the sidebar does not appear to
 * slide in when the data arrives.
 */
export default function LearnLoading() {
  return (
    <div className="flex min-h-[70vh] flex-col lg:flex-row">
      {/* --- curriculum sidebar ------------------------------------------- */}
      <aside className="hidden w-80 shrink-0 border-r border-border p-4 lg:block">
        <Skeleton className="mb-4 h-5 w-2/3" />
        <Skeleton className="mb-6 h-2 w-full" />

        {Array.from({ length: 4 }, (_, section) => (
          <div key={section} className="mb-5 flex flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            {Array.from({ length: 3 }, (_, lesson) => (
              <div key={lesson} className="flex items-center gap-2 pl-2">
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ))}
      </aside>

      {/* --- player and body ----------------------------------------------- */}
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-8">
        <Skeleton className="aspect-video w-full rounded-xl" />

        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>

        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full last:w-2/3" />
          ))}
        </div>
      </div>
    </div>
  );
}
