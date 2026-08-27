"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  Library,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

const items = [
  { href: routes.admin, label: "Overview", icon: LayoutDashboard },
  { href: routes.adminUsers, label: "Users", icon: Users },
  { href: routes.adminCourses, label: "Courses", icon: Library },
  { href: routes.adminCategories, label: "Categories", icon: FolderTree },
  { href: routes.adminPayments, label: "Payments", icon: CreditCard },
  { href: routes.adminReports, label: "Reports", icon: ChartNoAxesCombined },
] as const;

/**
 * Console navigation.
 *
 * `startsWith` for everything but the overview, so a filtered users list still
 * shows Users as current — the tab tracks the section, not the exact URL.
 */
function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin console" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max min-w-full gap-1 border-b border-border">
        {items.map((item) => {
          const active =
            item.href === routes.admin ? pathname === item.href : pathname.startsWith(item.href);

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

export { AdminNav };
