import "server-only";

import { db } from "@/server/db";
import type { NotifyType } from "@/features/engagement/notify";

/** Notifications for the bell menu and the full list. */
export interface NotificationView {
  id: string;
  type: NotifyType;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function getNotifications(userId: string, limit = 50): Promise<NotificationView[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type as NotifyType,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

/** Active reminders for a course, so the menu can show the current choice. */
export async function getCourseReminder(userId: string, courseId: string) {
  return db.courseReminder.findFirst({
    where: { userId, courseId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, frequency: true, nextRunAt: true, timeOfDay: true },
  });
}
