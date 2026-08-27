"use client";

import * as React from "react";
import { CircleCheck, CloudDownload, Loader2, TriangleAlert, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  downloadCourse,
  removeDownloadedCourse,
  OfflineStorageError,
  type DownloadProgress,
} from "@/offline/download";
import { getStoredCourse, isOfflineStorageSupported, type StoredCourse } from "@/offline/db";

/**
 * Download control for one course.
 *
 * Four states, each with its own affordance: not downloaded, downloading (with
 * real progress), available offline, and errored. The progress figures are
 * genuine stage reports from the download manager rather than a fake
 * animation — a bar that lies about what it is doing is worse than no bar.
 */
function DownloadButton({
  courseSlug,
  courseId,
  className,
  variant = "outline",
}: {
  courseSlug: string;
  courseId: string;
  className?: string;
  variant?: "outline" | "ghost";
}) {
  const [stored, setStored] = React.useState<StoredCourse | null>(null);
  const [progress, setProgress] = React.useState<DownloadProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [supported, setSupported] = React.useState(true);
  const [checked, setChecked] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (!isOfflineStorageSupported()) {
      setSupported(false);
      setChecked(true);
      return;
    }
    void getStoredCourse(courseId)
      .then((found) => setStored(found ?? null))
      .catch(() => setSupported(false))
      .finally(() => setChecked(true));
  }, [courseId]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function handleDownload() {
    setError(null);
    abortRef.current = new AbortController();

    try {
      const result = await downloadCourse({
        courseSlug,
        signal: abortRef.current.signal,
        onProgress: setProgress,
      });
      setStored(result);
      toast.success("Available offline", {
        description: "Articles and images are on this device. Videos still need a connection.",
      });
    } catch (caught) {
      const message =
        caught instanceof OfflineStorageError ? caught.message : "The download failed. Try again.";
      setError(message);
      toast.error("Download failed", { description: message });
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  async function handleRemove() {
    try {
      await removeDownloadedCourse(courseId);
      setStored(null);
      toast("Offline copy removed", { description: "The space has been freed." });
    } catch {
      toast.error("Could not remove the offline copy.");
    }
  }

  // Avoid flashing "Download" before the IndexedDB lookup resolves.
  if (!checked) {
    return (
      <Button variant={variant} size="sm" disabled className={className}>
        <Loader2 className="animate-spin" aria-hidden="true" />
        Checking
      </Button>
    );
  }

  if (!supported) {
    return (
      <Badge variant="neutral" size="sm" className={className}>
        Offline downloads are not supported in this browser
      </Badge>
    );
  }

  if (progress) {
    return (
      <div className={cn("flex min-w-56 flex-col gap-1.5", className)}>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          <span className="flex-1 text-muted-foreground">{progress.message}</span>
          <span className="font-mono text-2xs text-muted-foreground" data-numeric>
            {progress.percent}%
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-label="Download progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (stored) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Badge variant="success">
          <CircleCheck aria-hidden="true" />
          Available offline
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => void handleRemove()}>
          <Trash2 aria-hidden="true" />
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button variant={variant} size="sm" onClick={() => void handleDownload()}>
        <CloudDownload aria-hidden="true" />
        Download for offline
      </Button>
      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-danger" role="alert">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { DownloadButton };
