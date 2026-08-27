import { Quote } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TestimonialSummary } from "@/features/catalog/types";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { RatingStars } from "@/components/catalog/rating-stars";

function TestimonialCard({
  testimonial,
  className,
}: {
  testimonial: TestimonialSummary;
  className?: string;
}) {
  return (
    <Card className={cn("flex h-full flex-col gap-4 p-6", className)}>
      <Quote className="size-5 shrink-0 text-primary/50" aria-hidden="true" />

      <blockquote className="flex-1 text-base leading-relaxed text-pretty">
        {testimonial.quote}
      </blockquote>

      <RatingStars rating={testimonial.rating} size="sm" />

      <figcaption className="flex items-center gap-3 border-t border-border pt-4">
        <UserAvatar name={testimonial.author.name} src={testimonial.author.avatarUrl} size="sm" />
        <span className="flex flex-col">
          <span className="text-sm font-medium">{testimonial.author.name}</span>
          <span className="text-sm text-muted-foreground">{testimonial.author.role}</span>
        </span>
      </figcaption>

      <p className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
        {testimonial.courseTitle}
      </p>
    </Card>
  );
}

export { TestimonialCard };
