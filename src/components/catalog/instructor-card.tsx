import Link from "next/link";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { formatCompact } from "@/lib/format";
import type { InstructorSummary } from "@/features/catalog/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { RatingStars } from "@/components/catalog/rating-stars";

function InstructorCard({
  instructor,
  className,
}: {
  instructor: InstructorSummary;
  className?: string;
}) {
  return (
    <Card
      interactive
      className={cn("relative flex flex-col items-center gap-3 p-6 text-center", className)}
    >
      <UserAvatar name={instructor.name} src={instructor.avatarUrl} size="lg" />

      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold tracking-tight">
          <Link
            href={routes.instructor(instructor.slug)}
            className="after:absolute after:inset-0 after:content-[''] hover:text-primary"
          >
            {instructor.name}
          </Link>
        </h3>
        <p className="text-sm text-balance text-muted-foreground">{instructor.headline}</p>
      </div>

      <RatingStars rating={instructor.ratingAvg} />

      <dl className="flex w-full items-center justify-center gap-5 border-t border-border pt-3 text-sm">
        <div className="flex flex-col">
          <dt className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
            Learners
          </dt>
          <dd className="font-semibold" data-numeric>
            {formatCompact(instructor.studentCount)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
            Courses
          </dt>
          <dd className="font-semibold" data-numeric>
            {instructor.courseCount}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap justify-center gap-1.5">
        {instructor.expertise.slice(0, 3).map((topic) => (
          <Badge key={topic} variant="neutral" size="sm">
            {topic}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

export { InstructorCard };
