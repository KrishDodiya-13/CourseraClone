"use client";

import Link from "next/link";
import {
  Award,
  BookOpen,
  Compass,
  Heart,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  SquarePen,
  User,
} from "lucide-react";

import { routes } from "@/lib/routes";
import { useViewer } from "@/features/viewer/context";
import { logoutAction } from "@/features/auth/actions";
import type { CategorySummary } from "@/features/catalog/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchBar } from "@/components/catalog/search-bar";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { Logo } from "@/components/layout/logo";

function NavLink({
  href,
  icon: Icon,
  children,
  onNavigate,
  trailing,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  onNavigate: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      {children}
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1 font-mono text-2xs tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/**
 * Mobile navigation drawer.
 *
 * Mirrors the desktop navbar's role logic rather than duplicating it — the
 * same `useViewer()` object decides what appears, so the two can't disagree
 * about what a student or an admin should see.
 */
function MobileNav({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategorySummary[];
}) {
  const { viewer } = useViewer();
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0">
        <SheetHeader>
          <SheetTitle asChild>
            <span>
              <Logo />
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1 p-3">
          <div className="pb-2">
            <SearchBar id="mobile-search" onSubmitted={close} />
          </div>

          {viewer ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
              <UserAvatar name={viewer.name} src={viewer.avatarUrl} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{viewer.name}</span>
                <span className="truncate text-sm text-muted-foreground">{viewer.email}</span>
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-2">
              <Button fullWidth asChild onClick={close}>
                <Link href={routes.register}>Sign up</Link>
              </Button>
              <Button variant="outline" fullWidth asChild onClick={close}>
                <Link href={routes.login}>Log in</Link>
              </Button>
            </div>
          )}

          <SectionLabel>Browse</SectionLabel>
          <NavLink href={routes.courses} icon={Compass} onNavigate={close}>
            All courses
          </NavLink>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={routes.category(category.slug)}
              onClick={close}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <CategoryIcon iconKey={category.iconKey} className="size-4" />
              {category.name}
            </Link>
          ))}

          {viewer ? (
            <>
              <SectionLabel>Learning</SectionLabel>
              <NavLink href={routes.dashboard} icon={LayoutDashboard} onNavigate={close}>
                Dashboard
              </NavLink>
              <NavLink href={routes.myLearning} icon={BookOpen} onNavigate={close}>
                My learning
              </NavLink>
              <NavLink
                href={routes.wishlist}
                icon={Heart}
                onNavigate={close}
                trailing={
                  viewer.wishlistCount > 0 ? (
                    <Badge variant="primary" size="sm">
                      {viewer.wishlistCount}
                    </Badge>
                  ) : null
                }
              >
                Wishlist
              </NavLink>
              <NavLink href={routes.certificates} icon={Award} onNavigate={close}>
                Certificates
              </NavLink>

              {viewer.role === "INSTRUCTOR" || viewer.role === "ADMIN" ? (
                <>
                  <SectionLabel>Instructor</SectionLabel>
                  <NavLink href={routes.studio} icon={SquarePen} onNavigate={close}>
                    Instructor studio
                  </NavLink>
                </>
              ) : null}

              {viewer.role === "ADMIN" ? (
                <>
                  <SectionLabel>Admin</SectionLabel>
                  <NavLink href={routes.admin} icon={ShieldCheck} onNavigate={close}>
                    Admin console
                  </NavLink>
                </>
              ) : null}

              <SectionLabel>Account</SectionLabel>
              <NavLink href={routes.profile} icon={User} onNavigate={close}>
                Profile
              </NavLink>
              <NavLink href={routes.settings} icon={Settings} onNavigate={close}>
                Settings
              </NavLink>
              <form action={logoutAction}>
                <button
                  type="submit"
                  onClick={close}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-subtle"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <SectionLabel>Teach</SectionLabel>
              <NavLink href={routes.becomeInstructor} icon={SquarePen} onNavigate={close}>
                Become an instructor
              </NavLink>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { MobileNav };
