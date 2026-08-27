import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * Offline storage.
 *
 * IndexedDB, not localStorage. Three reasons that matter here: localStorage is
 * synchronous and blocks the main thread, it caps out around 5MB, and it only
 * stores strings — so a course bundle would have to be re-parsed on every
 * read. IndexedDB is async, structured, and bounded by the origin quota
 * instead.
 *
 * Nothing in this database is a secret. Course bundles are content the user is
 * already authorised to read, and no token, cookie or session value is ever
 * written here — an offline store is readable by anything with access to the
 * device profile.
 */

export const DB_NAME = "lumen-offline";
export const DB_VERSION = 1;

export type OutboxStatus = "pending" | "syncing" | "failed";

/** A downloaded course, stored whole. */
export interface StoredCourse {
  courseId: string;
  slug: string;
  title: string;
  subtitle: string;
  /** Full curriculum + lesson bodies. Shape mirrors the bundle endpoint. */
  bundle: OfflineBundle;
  /** ISO 8601. */
  downloadedAt: string;
  /** Approximate bytes, for the storage readout. */
  sizeBytes: number;
  /** Cache Storage keys for this course's images, so removal is complete. */
  imageUrls: string[];
}

/** One queued progress event waiting to reach the server. */
export interface OutboxEntry {
  id?: number;
  courseId: string;
  lessonId: string;
  positionSeconds: number;
  completed?: boolean;
  /** Client clock at the moment of the event — used for conflict ordering. */
  clientUpdatedAt: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
}

/* -------------------------------------------------------------------------- */
/*  Bundle shape (shared with the server route)                               */
/* -------------------------------------------------------------------------- */

export interface OfflineLesson {
  id: string;
  title: string;
  summary: string | null;
  type: "VIDEO" | "ARTICLE" | "PDF" | "QUIZ" | "ASSIGNMENT";
  durationSeconds: number;
  isRequired: boolean;
  position: number;
  /** Present for ARTICLE lessons only. */
  articleContent: string | null;
  /**
   * Deliberately absent for video: no playback id, no signed URL, no media.
   * `videoAvailableOffline` is always false and exists so the UI can say so
   * plainly rather than showing a player that cannot work.
   */
  videoAvailableOffline: false;
  resources: Array<{
    id: string;
    title: string;
    kind: string;
    externalUrl: string | null;
  }>;
  /** Image URLs referenced by the article body, extracted server-side. */
  imageUrls: string[];
}

export interface OfflineSection {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: OfflineLesson[];
}

export interface OfflineBundle {
  courseId: string;
  slug: string;
  title: string;
  subtitle: string;
  sequentialProgress: boolean;
  sections: OfflineSection[];
  /** Snapshot of the learner's progress at download time. */
  progress: Array<{ lessonId: string; completed: boolean; positionSeconds: number }>;
  /** ISO 8601 — the server's view, used to detect a stale bundle. */
  generatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Database                                                                  */
/* -------------------------------------------------------------------------- */

interface CourseraDB extends DBSchema {
  courses: {
    key: string;
    value: StoredCourse;
    indexes: { "by-slug": string };
  };
  outbox: {
    key: number;
    value: OutboxEntry;
    indexes: { "by-status": OutboxStatus; "by-course": string };
  };
}

let dbPromise: Promise<IDBPDatabase<CourseraDB>> | null = null;

/** Whether this browser can store anything offline at all. */
export function isOfflineStorageSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export function getDb(): Promise<IDBPDatabase<CourseraDB>> {
  if (!isOfflineStorageSupported()) {
    return Promise.reject(new Error("This browser does not support offline storage."));
  }

  dbPromise ??= openDB<CourseraDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const courses = database.createObjectStore("courses", { keyPath: "courseId" });
      courses.createIndex("by-slug", "slug", { unique: true });

      const outbox = database.createObjectStore("outbox", {
        keyPath: "id",
        autoIncrement: true,
      });
      outbox.createIndex("by-status", "status");
      outbox.createIndex("by-course", "courseId");
    },
    blocking() {
      // Another tab is upgrading. Close so it can proceed rather than
      // deadlocking both tabs.
      void dbPromise?.then((database) => database.close());
      dbPromise = null;
    },
  });

  return dbPromise;
}

/* -------------------------------------------------------------------------- */
/*  Courses                                                                   */
/* -------------------------------------------------------------------------- */

export async function putStoredCourse(course: StoredCourse): Promise<void> {
  const db = await getDb();
  await db.put("courses", course);
}

export async function getStoredCourse(courseId: string): Promise<StoredCourse | undefined> {
  const db = await getDb();
  return db.get("courses", courseId);
}

export async function getStoredCourseBySlug(slug: string): Promise<StoredCourse | undefined> {
  const db = await getDb();
  return db.getFromIndex("courses", "by-slug", slug);
}

export async function listStoredCourses(): Promise<StoredCourse[]> {
  const db = await getDb();
  return db.getAll("courses");
}

export async function deleteStoredCourse(courseId: string): Promise<void> {
  const db = await getDb();
  await db.delete("courses", courseId);
}

/* -------------------------------------------------------------------------- */
/*  Outbox                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Queues a progress event.
 *
 * Coalesces against an existing pending entry for the same lesson rather than
 * appending: a learner scrubbing through a video offline would otherwise queue
 * hundreds of rows for one lesson, all but the last of them stale.
 */
export async function enqueueProgress(
  entry: Omit<OutboxEntry, "id" | "status" | "attempts">,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("outbox", "readwrite");
  const store = tx.objectStore("outbox");

  const existing = await store.index("by-course").getAll(entry.courseId);
  const pending = existing.find(
    (row) => row.lessonId === entry.lessonId && row.status !== "syncing",
  );

  if (pending?.id !== undefined) {
    await store.put({
      ...pending,
      // Never rewind, even locally — the same rule the server enforces.
      positionSeconds: Math.max(pending.positionSeconds, entry.positionSeconds),
      completed: entry.completed ?? pending.completed,
      clientUpdatedAt: entry.clientUpdatedAt,
      status: "pending",
    });
  } else {
    await store.add({ ...entry, status: "pending", attempts: 0 });
  }

  await tx.done;
}

export async function getPendingProgress(): Promise<OutboxEntry[]> {
  const db = await getDb();
  const all = await db.getAll("outbox");
  return all.filter((entry) => entry.status !== "syncing");
}

export async function markOutboxEntries(
  ids: number[],
  status: OutboxStatus,
  error?: string,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("outbox", "readwrite");
  for (const id of ids) {
    const entry = await tx.store.get(id);
    if (!entry) continue;
    await tx.store.put({
      ...entry,
      status,
      attempts: status === "failed" ? entry.attempts + 1 : entry.attempts,
      lastError: error,
    });
  }
  await tx.done;
}

export async function deleteOutboxEntries(ids: number[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("outbox", "readwrite");
  for (const id of ids) await tx.store.delete(id);
  await tx.done;
}

export async function countPendingProgress(): Promise<number> {
  const entries = await getPendingProgress();
  return entries.length;
}

/* -------------------------------------------------------------------------- */
/*  Storage estimate                                                          */
/* -------------------------------------------------------------------------- */

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  /** Null when the browser will not report a quota. */
  percentUsed: number | null;
}

export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return {
      usageBytes: usage,
      quotaBytes: quota,
      percentUsed: quota > 0 ? Math.round((usage / quota) * 100) : null,
    };
  } catch {
    return null;
  }
}
