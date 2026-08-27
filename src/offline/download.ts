"use client";

import {
  deleteStoredCourse,
  getStoredCourse,
  putStoredCourse,
  type OfflineBundle,
  type StoredCourse,
} from "@/offline/db";

/**
 * Download manager.
 *
 * Fetches an authorised bundle, stores it in IndexedDB, and pre-caches the
 * images its articles reference into Cache Storage. Images go to Cache Storage
 * rather than IndexedDB because that is the store the service worker can serve
 * from directly on a subsequent request — an image blob in IndexedDB would
 * have to be read out and re-injected by JavaScript on every render.
 *
 * Videos are never fetched here. The bundle contains no media source to fetch.
 */

export const IMAGE_CACHE = "lumen-offline-images-v1";

export type DownloadStage = "idle" | "fetching" | "storing" | "images" | "done" | "error";

export interface DownloadProgress {
  stage: DownloadStage;
  /** 0-100. */
  percent: number;
  message: string;
}

export class OfflineStorageError extends Error {
  readonly kind: "quota" | "unsupported" | "network" | "forbidden" | "unknown";

  constructor(kind: OfflineStorageError["kind"], message: string) {
    super(message);
    this.name = "OfflineStorageError";
    this.kind = kind;
  }
}

function classify(error: unknown): OfflineStorageError {
  if (error instanceof OfflineStorageError) return error;

  if (error instanceof DOMException) {
    // Both spellings appear across browsers.
    if (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED") {
      return new OfflineStorageError(
        "quota",
        "There is not enough space on this device. Remove a downloaded course and try again.",
      );
    }
  }

  if (error instanceof TypeError) {
    return new OfflineStorageError(
      "network",
      "The download could not complete. Check your connection and try again.",
    );
  }

  return new OfflineStorageError("unknown", "The download failed. Try again.");
}

/** Rough byte count of the JSON payload, for the storage readout. */
function measure(bundle: OfflineBundle): number {
  try {
    return new Blob([JSON.stringify(bundle)]).size;
  } catch {
    return 0;
  }
}

export interface DownloadOptions {
  courseSlug: string;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

export async function downloadCourse({
  courseSlug,
  onProgress,
  signal,
}: DownloadOptions): Promise<StoredCourse> {
  const report = (stage: DownloadStage, percent: number, message: string) =>
    onProgress?.({ stage, percent, message });

  try {
    report("fetching", 10, "Fetching course content…");

    const response = await fetch(
      `/api/learn/offline-bundle?courseSlug=${encodeURIComponent(courseSlug)}`,
      { signal, credentials: "same-origin" },
    );

    if (response.status === 401) {
      throw new OfflineStorageError("forbidden", "Sign in to download this course.");
    }
    if (response.status === 403) {
      throw new OfflineStorageError(
        "forbidden",
        "You need to be enrolled in this course to download it.",
      );
    }
    if (!response.ok) {
      throw new OfflineStorageError("network", "The course could not be fetched.");
    }

    const bundle = (await response.json()) as OfflineBundle;

    report("storing", 40, "Saving lessons…");

    // --- images ----------------------------------------------------------
    const imageUrls = [
      ...new Set(
        bundle.sections.flatMap((section) => section.lessons.flatMap((lesson) => lesson.imageUrls)),
      ),
    ];

    const cachedImages: string[] = [];

    if (imageUrls.length > 0 && typeof caches !== "undefined") {
      report("images", 55, `Caching ${imageUrls.length} images…`);
      const cache = await caches.open(IMAGE_CACHE);

      for (const [position, url] of imageUrls.entries()) {
        if (signal?.aborted) throw new OfflineStorageError("unknown", "Download cancelled.");
        try {
          await cache.add(new Request(url, { mode: "no-cors" }));
          cachedImages.push(url);
        } catch {
          // One unreachable image must not fail the whole course — the lesson
          // text is the part that matters offline.
        }
        report(
          "images",
          55 + Math.round(((position + 1) / imageUrls.length) * 35),
          `Caching images… ${position + 1} of ${imageUrls.length}`,
        );
      }
    }

    report("storing", 95, "Finishing up…");

    const stored: StoredCourse = {
      courseId: bundle.courseId,
      slug: bundle.slug,
      title: bundle.title,
      subtitle: bundle.subtitle,
      bundle,
      downloadedAt: new Date().toISOString(),
      sizeBytes: measure(bundle),
      imageUrls: cachedImages,
    };

    await putStoredCourse(stored);

    report("done", 100, "Available offline");
    return stored;
  } catch (error) {
    const classified = classify(error);
    report("error", 0, classified.message);
    throw classified;
  }
}

/**
 * Removes a course and everything it brought with it.
 *
 * Images are deleted from Cache Storage too — leaving them behind would mean
 * "remove download" quietly freed almost nothing, which is the opposite of
 * what the user asked for.
 */
export async function removeDownloadedCourse(courseId: string): Promise<void> {
  const stored = await getStoredCourse(courseId);

  if (stored && typeof caches !== "undefined") {
    try {
      const cache = await caches.open(IMAGE_CACHE);
      await Promise.all(stored.imageUrls.map((url) => cache.delete(new Request(url))));
    } catch {
      // A failure to clear images should not block removing the course.
    }
  }

  await deleteStoredCourse(courseId);
}

/** Whether a stored bundle predates the server's current content. */
export function isBundleStale(stored: StoredCourse, serverUpdatedAt?: string): boolean {
  if (!serverUpdatedAt) return false;
  return Date.parse(serverUpdatedAt) > Date.parse(stored.bundle.generatedAt);
}
