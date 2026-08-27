import Link from "next/link";
import type * as React from "react";

import { routes } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/layout/logo";

/**
 * Shared frame for the four auth screens.
 *
 * One component so the four pages cannot drift apart in width, spacing or
 * heading level — the thing that always happens when each is built separately.
 */
function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:py-20">
      <Link href={routes.home} className="mx-auto rounded-md" aria-label="Coursera home">
        <Logo />
      </Link>

      <Card variant="elevated" className="p-6 sm:p-8">
        <div className="flex flex-col gap-1.5 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </Card>

      {footer ? <p className="text-center text-sm text-muted-foreground">{footer}</p> : null}
    </div>
  );
}

export { AuthShell };
