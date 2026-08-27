import "server-only";

import { db } from "@/server/db";
import { getSessionUser } from "@/server/authz";
import type { Viewer, ViewerNotification } from "@/features/viewer/types";

/**
 * Resolves the current viewer on the server.
 *
 * The session supplies identity and role; the two badge counts come from one
 * query. Returns `null` for a guest, which is the shape the whole UI already
 * branches on.
 */
export async function getViewer(): Promise<Viewer> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const counts = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      profile: { select: { avatarUrl: true } },
      _count: {
        select: {
          wishlist: true,
          notifications: { where: { readAt: null } },
        },
      },
    },
  });

  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    avatarUrl: counts?.profile?.avatarUrl ?? null,
    role: sessionUser.role,
    wishlistCount: counts?._count.wishlist ?? 0,
    unreadNotificationCount: counts?._count.notifications ?? 0,
  };
}

/**
 * Recent notifications for the bell menu.
 *
 * Phase 13 adds live delivery over SSE; this read is already the right shape
 * for it.
 */
export async function getViewerNotifications(viewer: Viewer): Promise<ViewerNotification[]> {
  if (!viewer) return [];

  const rows = await db.notification.findMany({
    where: { userId: viewer.id },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    href: row.href ?? "/notifications",
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
