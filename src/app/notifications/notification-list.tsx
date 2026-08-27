"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Bell,
  BookOpenCheck,
  CheckCheck,
  ClipboardCheck,
  CreditCard,
  Flame,
  ListChecks,
  Medal,
  Megaphone,
  UserCog,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/engagement/actions";
import type { NotificationView } from "@/features/engagement/queries";
import type { NotifyType } from "@/features/engagement/notify";

/** Icon per type, so the kind of message is never colour-alone. */
const typeIcons: Record<NotifyType, LucideIcon> = {
  COURSE_PUBLISHED: Megaphone,
  LESSON_ADDED: BookOpenCheck,
  ENROLMENT_CONFIRMED: ClipboardCheck,
  ASSIGNMENT_REVIEWED: ClipboardCheck,
  QUIZ_GRADED: ListChecks,
  CERTIFICATE_ISSUED: Award,
  STREAK_AT_RISK: Flame,
  STREAK_MILESTONE: Flame,
  BADGE_EARNED: Medal,
  STUDY_REMINDER: Bell,
  ANNOUNCEMENT: Megaphone,
  PAYMENT_RECEIPT: CreditCard,
  ACCOUNT: UserCog,
};

const typeTones: Record<NotifyType, string> = {
  COURSE_PUBLISHED: "bg-info-subtle text-info",
  LESSON_ADDED: "bg-info-subtle text-info",
  ENROLMENT_CONFIRMED: "bg-primary-subtle text-primary-subtle-foreground",
  ASSIGNMENT_REVIEWED: "bg-success-subtle text-success",
  QUIZ_GRADED: "bg-info-subtle text-info",
  CERTIFICATE_ISSUED: "bg-accent-subtle text-accent-subtle-foreground",
  STREAK_AT_RISK: "bg-warning-subtle text-warning-foreground",
  STREAK_MILESTONE: "bg-accent-subtle text-accent-subtle-foreground",
  BADGE_EARNED: "bg-warning-subtle text-warning-foreground",
  STUDY_REMINDER: "bg-secondary text-muted-foreground",
  ANNOUNCEMENT: "bg-info-subtle text-info",
  PAYMENT_RECEIPT: "bg-secondary text-muted-foreground",
  ACCOUNT: "bg-secondary text-muted-foreground",
};

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/**
 * The full notification list.
 *
 * Read state is optimistic: the row settles immediately and the server call
 * follows. Marking as read is not a destructive act, so a failure here is
 * quiet — the next page load simply shows it unread again.
 */
function NotificationList({
  notifications,
  unreadCount,
}: {
  notifications: NotificationView[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const [allRead, setAllRead] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const isRead = (notification: NotificationView) =>
    allRead || notification.readAt !== null || readIds.has(notification.id);

  const remainingUnread = allRead
    ? 0
    : notifications.filter((notification) => !isRead(notification)).length;

  function markOne(notification: NotificationView) {
    if (isRead(notification)) return;
    setReadIds((current) => new Set(current).add(notification.id));
    startTransition(async () => {
      await markNotificationReadAction(notification.id);
      router.refresh();
    });
  }

  function markAll() {
    setAllRead(true);
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (result.ok && result.data) {
        toast.success(
          `Marked ${result.data.count} notification${result.data.count === 1 ? "" : "s"} as read`,
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {unreadCount > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground" data-numeric>
            {remainingUnread} unread
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={markAll}
            disabled={pending || remainingUnread === 0}
          >
            <CheckCheck aria-hidden="true" />
            Mark all as read
          </Button>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {notifications.map((notification) => {
          const Icon = typeIcons[notification.type] ?? Bell;
          const read = isRead(notification);

          const body = (
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className={cn("text-sm", read ? "font-medium" : "font-semibold")}>
                  {notification.title}
                </span>
                <span className="text-sm text-muted-foreground">
                  {relativeTime(notification.createdAt)}
                </span>
                {!read ? (
                  <Badge variant="primary" size="sm">
                    New
                  </Badge>
                ) : null}
              </span>
              <span className="text-sm text-muted-foreground">{notification.body}</span>
            </div>
          );

          return (
            <li key={notification.id}>
              <Card
                className={cn(
                  "flex items-start gap-3 p-4 transition-colors",
                  read ? "opacity-70" : "border-primary/30 bg-primary-subtle/25",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    typeTones[notification.type] ?? "bg-secondary text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>

                {notification.href ? (
                  <Link
                    href={notification.href}
                    onClick={() => markOne(notification)}
                    className="flex flex-1 gap-3"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}

                {!read ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Mark "${notification.title}" as read`}
                    onClick={() => markOne(notification)}
                  >
                    <CheckCheck aria-hidden="true" />
                  </Button>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { NotificationList, typeIcons, typeTones, relativeTime };
