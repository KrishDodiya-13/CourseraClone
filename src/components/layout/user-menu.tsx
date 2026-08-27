"use client";

import * as React from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
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
import type { AuthenticatedViewer } from "@/features/viewer/types";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const roleLabels: Record<AuthenticatedViewer["role"], string> = {
  STUDENT: "Student",
  INSTRUCTOR: "Instructor",
  ADMIN: "Admin",
};

/**
 * Account menu for a signed-in viewer.
 *
 * The menu is assembled from the viewer's role — an instructor gets the studio
 * group, an admin additionally gets the admin group. Nothing here grants
 * access: these are links, and every destination re-checks authorisation
 * server-side once Phase 4 lands. Hiding a link is a courtesy, not a control.
 */
function UserMenu() {
  // Keeps the item disabled and labelled while the action is in flight, so a
  // second click cannot fire a second sign-out.
  const [signingOut, startSignOut] = React.useTransition();

  const { viewer } = useViewer();
  if (!viewer) return null;

  const showStudio = viewer.role === "INSTRUCTOR" || viewer.role === "ADMIN";
  const showAdmin = viewer.role === "ADMIN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full transition-opacity hover:opacity-80"
          aria-label={`Account menu for ${viewer.name}`}
        >
          <UserAvatar name={viewer.name} src={viewer.avatarUrl} size="sm" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="normal-case">
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{viewer.name}</span>
              <Badge variant="primary" size="sm">
                {roleLabels[viewer.role]}
              </Badge>
            </span>
            <span className="truncate font-sans text-sm text-muted-foreground normal-case">
              {viewer.email}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={routes.dashboard}>
              <LayoutDashboard aria-hidden="true" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={routes.myLearning}>
              <BookOpen aria-hidden="true" />
              My learning
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={routes.wishlist}>
              <Heart aria-hidden="true" />
              Wishlist
              {viewer.wishlistCount > 0 ? (
                <span className="ml-auto font-mono text-2xs text-muted-foreground">
                  {viewer.wishlistCount}
                </span>
              ) : null}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={routes.certificates}>
              <Award aria-hidden="true" />
              Certificates
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {showStudio ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Instructor</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={routes.studio}>
                <SquarePen aria-hidden="true" />
                Instructor studio
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}

        {showAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Admin</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={routes.admin}>
                <ShieldCheck aria-hidden="true" />
                Admin console
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={routes.profile}>
            <User aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={routes.settings}>
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Signing out is a state change, so it must never be a link a prefetch
            or a crawler could trigger — it calls the server action directly.

            It is deliberately NOT a <form> nested inside this item. Radix
            treats a menu item's click as a selection: it preventDefaults and
            closes the menu, which unmounted the form before it could submit.
            The result was a Sign out button that fired no request at all and
            left the session intact. Calling the action from `onSelect` is the
            reliable path, and a server action is still a POST. */}
        <DropdownMenuItem
          variant="danger"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            startSignOut(async () => {
              await logoutAction();
            });
          }}
        >
          <LogOut aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { UserMenu };
