"use client";

import Link from "next/link";
import { Bell, BellOff, CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { useViewer } from "@/features/viewer/context";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import * as React from "react";
import { markAllNotificationsReadAction } from "@/features/engagement/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Relative time without pulling in a date library for four strings. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/**
 * Notification bell.
 *
 * Phase 13 wires the unread count and the list to the `Notification` table and
 * pushes new ones over SSE. The badge caps at 9+ so a large count cannot break
 * the header layout.
 */
function NotificationsMenu() {
  const { viewer, notifications } = useViewer();
  const router = useRouter();
  const [dismissed, setDismissed] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  if (!viewer) return null;

  const unread = dismissed ? 0 : viewer.unreadNotificationCount;

  function markAll() {
    setDismissed(true);
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications, none unread"}
        >
          <Bell aria-hidden="true" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] leading-none font-bold text-danger-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="px-0 py-0">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAll}
              disabled={pending}
              className="inline-flex items-center gap-1 text-2xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              <CheckCheck className="size-3" aria-hidden="true" />
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <BellOff className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">You are all caught up.</p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  href={notification.href}
                  className={cn(
                    "flex flex-col gap-1 px-3 py-2.5 transition-colors hover:bg-secondary",
                    notification.readAt === null && "bg-primary-subtle/40",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{notification.title}</span>
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {relativeTime(notification.createdAt)}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{notification.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <DropdownMenuSeparator className="mx-0 my-0" />
        <Link
          href={routes.notifications}
          className="block px-3 py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-secondary"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { NotificationsMenu };
