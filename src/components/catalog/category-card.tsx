import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { formatCompact } from "@/lib/format";
import type { CategorySummary } from "@/features/catalog/types";
import { Card } from "@/components/ui/card";
import { CategoryIcon } from "@/components/catalog/category-icon";

function CategoryCard({ category, className }: { category: CategorySummary; className?: string }) {
  return (
    <Card interactive className={cn("group relative flex flex-col gap-3 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary-subtle text-primary-subtle-foreground">
          <CategoryIcon iconKey={category.iconKey} className="size-5" />
        </span>
        <ArrowUpRight
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold tracking-tight">
          <Link
            href={routes.category(category.slug)}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {category.name}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{category.description}</p>
      </div>

      <p className="mt-auto pt-1 text-sm text-muted-foreground" data-numeric>
        {formatCompact(category.courseCount)} courses
      </p>
    </Card>
  );
}

export { CategoryCard };
