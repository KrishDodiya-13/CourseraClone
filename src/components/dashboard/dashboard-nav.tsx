"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BookOpen, Heart, LayoutDashboard, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

const items = [
  { href: routes.dashboard, label: "Overview", icon: LayoutDashboard },
  { href: routes.dashboardCourses, label: "My courses", icon: BookOpen },
  { href: routes.dashboardProgress, label: "Progress", icon: TrendingUp },
  { href: routes.dashboardCertificates, label: "Certificates", icon: Award },
  { href: routes.dashboardWishlist, label: "Wishlist", icon: Heart },
] as const;

/** Horizontal, scrollable on narrow screens rather than wrapping into rows. */
function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max min-w-full gap-1 border-b border-border">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 px-3 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { DashboardNav };
