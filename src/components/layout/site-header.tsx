"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Heart, LayoutGrid, Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { useViewer } from "@/features/viewer/context";
import type { CategorySummary } from "@/features/catalog/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SearchBar } from "@/components/catalog/search-bar";
import { CategoryIcon } from "@/components/catalog/category-icon";

/**
 * The public navbar.
 *
 * Everything role-dependent reads from `useViewer()`, so the four states
 * (guest, student, instructor, admin) are one data path rather than four
 * layouts.
 *
 * Two composition decisions carry the design. Search takes the centre and the
 * remaining width, because finding a course is the single most common reason
 * anyone touches this bar — burying it behind an icon would be an aesthetic
 * choice paid for by every visitor. And the row stays 64px: a taller bar looks
 * more designed in a screenshot and costs vertical space on every page,
 * forever, on the smallest screens that can least afford it.
 */
function SiteHeader({ categories }: { categories: CategorySummary[] }) {
  const pathname = usePathname();
  const { viewer } = useViewer();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  /** Active nav items get a weight change and an underline, never colour alone. */
  const navLink = (active: boolean) =>
    cn(
      "relative inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors",
      "after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:transition-colors",
      active
        ? "font-semibold text-foreground after:bg-primary"
        : "font-medium text-muted-foreground after:bg-transparent hover:text-foreground",
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 sm:px-6 lg:gap-4 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-1 lg:hidden"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu aria-hidden="true" />
        </Button>

        <Link href={routes.home} className="shrink-0 rounded-md" aria-label="Coursera home">
          <Logo />
        </Link>

        {/* --- desktop navigation ---------------------------------------- */}
        <nav aria-label="Main" className="hidden items-center lg:ml-2 lg:flex">
          <Link
            href={routes.courses}
            aria-current={isActive(routes.courses) ? "page" : undefined}
            className={navLink(isActive(routes.courses))}
          >
            Courses
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-current={isActive(routes.categories) ? "page" : undefined}
                className={cn(
                  navLink(isActive(routes.categories)),
                  "data-[state=open]:text-foreground",
                )}
              >
                Categories
                <ChevronDown
                  className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </button>
            </DropdownMenuTrigger>

            {/* A two-column panel rather than a list: eight categories in one
                column is a scroll, and the icons only earn their space when
                they can be scanned as a grid. */}
            <DropdownMenuContent align="start" className="w-[30rem] p-2">
              <div className="grid grid-cols-2 gap-0.5">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={routes.category(category.slug)}
                    className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-secondary focus-visible:bg-secondary"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary-subtle-foreground">
                      <CategoryIcon iconKey={category.iconKey} className="size-4.5" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{category.name}</span>
                      <span className="text-2xs text-muted-foreground" data-numeric>
                        {category.courseCount} course{category.courseCount === 1 ? "" : "s"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>

              <div className="mt-1 border-t border-border pt-1">
                <Link
                  href={routes.categories}
                  className="flex items-center gap-2 rounded-lg p-2.5 text-sm font-medium text-primary transition-colors hover:bg-secondary"
                >
                  <LayoutGrid className="size-4" aria-hidden="true" />
                  Browse all categories
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* --- search: takes the centre and the slack ---------------------- */}
        <div className="ml-auto hidden max-w-lg flex-1 md:flex lg:ml-4">
          <SearchBar id="header-search" />
        </div>

        {/* --- right cluster ---------------------------------------------- */}
        <div className="ml-auto flex items-center gap-0.5 md:ml-2">
          {viewer ? (
            <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex" asChild>
              <Link
                href={routes.wishlist}
                aria-label={
                  viewer.wishlistCount > 0
                    ? `Wishlist, ${viewer.wishlistCount} saved`
                    : "Wishlist, empty"
                }
              >
                <Heart aria-hidden="true" />
                {viewer.wishlistCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] leading-none font-bold text-primary-foreground"
                  >
                    {viewer.wishlistCount > 9 ? "9+" : viewer.wishlistCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          ) : null}

          <NotificationsMenu />
          <ThemeToggle />

          {viewer ? (
            <div className="ml-1.5">
              <UserMenu />
            </div>
          ) : (
            <div className="ml-1.5 hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href={routes.login}>Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={routes.register}>Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} categories={categories} />
    </header>
  );
}

export { SiteHeader };
