import Link from "next/link";
import {
  Award,
  BookOpenCheck,
  GraduationCap,
  ListChecks,
  Medal,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import type { ActivityEvent } from "@/features/dashboard/queries";
import { relativeDay } from "@/components/dashboard/course-progress-card";

const kindIcons: Record<ActivityEvent["kind"], LucideIcon> = {
  lesson: BookOpenCheck,
  course: GraduationCap,
  certificate: Award,
  quiz: ListChecks,
  badge: Medal,
};

const kindTones: Record<ActivityEvent["kind"], string> = {
  lesson: "bg-primary-subtle text-primary-subtle-foreground",
  course: "bg-success-subtle text-success",
  certificate: "bg-accent-subtle text-accent-subtle-foreground",
  quiz: "bg-info-subtle text-info",
  badge: "bg-warning-subtle text-warning-foreground",
};

/**
 * Recent activity.
 *
 * A list, not a chart — these are discrete events with names, and the useful
 * question is "what did I do", which a timeline answers and a plot does not.
 * Icon and label carry the event type, so the tone colours are reinforcement
 * rather than the only signal.
 */
function ActivityFeed({ events, className }: { events: ActivityEvent[]; className?: string }) {
  return (
    <Card className={cn("flex flex-col gap-4 p-5", className)}>
      <h2 className="text-lg font-semibold">Recent activity</h2>

      {events.length === 0 ? (
        <EmptyState
          bordered
          size="sm"
          icon={<BookOpenCheck aria-hidden="true" />}
          title="Nothing yet"
          description="Finish a lesson and it will show up here."
        />
      ) : (
        <ol className="flex flex-col">
          {events.map((event, index) => {
            const Icon = kindIcons[event.kind];
            return (
              <li key={event.id} className="flex gap-3">
                {/* Timeline rail: the line stops at the last item. */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      kindTones[event.kind],
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  {index < events.length - 1 ? (
                    <span className="w-px flex-1 bg-border" aria-hidden="true" />
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    {event.href ? (
                      <Link href={event.href} className="text-sm font-medium hover:text-primary">
                        {event.title}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">{event.title}</span>
                    )}
                    <span className="text-sm text-muted-foreground">{relativeDay(event.at)}</span>
                  </span>
                  {event.detail ? (
                    <span className="truncate text-sm text-muted-foreground">{event.detail}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

export { ActivityFeed };
