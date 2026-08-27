/**
 * The current user, as the UI needs to know them.
 *
 * Shaped to match what Auth.js will return in Phase 4: an authenticated
 * viewer or `null` for a guest. Nothing in the UI branches on anything other
 * than this object, so swapping the stub in `get-viewer.ts` for a real
 * `auth()` call is the only change Phase 4 needs to make here.
 */

export type UserRole = "STUDENT" | "INSTRUCTOR" | "ADMIN";

export interface AuthenticatedViewer {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  /** Drives the wishlist count badge. */
  wishlistCount: number;
  /** Drives the notification bell badge. */
  unreadNotificationCount: number;
}

/** `null` is a guest — matches the shape of a missing Auth.js session. */
export type Viewer = AuthenticatedViewer | null;

export interface ViewerNotification {
  id: string;
  title: string;
  body: string;
  /** ISO 8601. Rendered relative at display time. */
  createdAt: string;
  readAt: string | null;
  /** Where clicking the notification takes the user. */
  href: string;
}

export function isInstructor(viewer: Viewer): boolean {
  return viewer?.role === "INSTRUCTOR" || viewer?.role === "ADMIN";
}

export function isAdmin(viewer: Viewer): boolean {
  return viewer?.role === "ADMIN";
}
