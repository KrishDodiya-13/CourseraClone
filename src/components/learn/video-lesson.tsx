"use client";

import * as React from "react";
import { Check, Pause, Play, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatTimecode } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLessonProgress } from "@/features/learning/use-lesson-progress";
import type { ProgressActionResult } from "@/features/learning/actions";

/**
 * Video lesson.
 *
 * The progress machinery is real and provider-agnostic — it drives off
 * `timeupdate`, `pause`, `seeked` and `ended`, which every HTML5 media element
 * emits. When Phase 8 supplies a signed source, `src` is passed and the same
 * hooks run against real media with no changes here.
 *
 * Until then the surface below is a labelled stand-in with a working
 * transport, so resume, throttled syncing and completion can be exercised
 * end to end rather than waiting on the media pipeline.
 *
 * Autoplay: never automatic. Browsers block unmuted autoplay, and a lesson
 * that starts talking on page load is hostile anyway. Resuming always requires
 * a deliberate press — which doubles as the user gesture playback needs.
 */
function VideoLesson({
  courseId,
  courseSlug,
  lessonId,
  durationSeconds,
  initialPositionSeconds,
  initialCompleted,
  src,
  poster,
  onCompletion,
}: {
  courseId: string;
  courseSlug: string;
  lessonId: string;
  durationSeconds: number;
  initialPositionSeconds: number;
  initialCompleted: boolean;
  /** Signed playback URL. Absent until the Phase 8 media pipeline. */
  src?: string | null;
  poster?: string | null;
  onCompletion?: (result: ProgressActionResult) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const progress = useLessonProgress({
    courseId,
    courseSlug,
    lessonId,
    durationSeconds,
    initialPositionSeconds,
    initialCompleted,
    onCompletion,
  });

  const [position, setPosition] = React.useState(initialPositionSeconds);
  const [playing, setPlaying] = React.useState(false);
  const [resumeOffered, setResumeOffered] = React.useState(progress.canResume);

  React.useEffect(() => {
    setPosition(initialPositionSeconds);
    setPlaying(false);
    setResumeOffered(progress.canResume);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per lesson
  }, [lessonId]);

  const duration = durationSeconds || 0;

  /* --- shared transport ------------------------------------------------- */

  const seekTo = React.useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, Math.min(seconds, duration));
      setPosition(clamped);
      if (videoRef.current) videoRef.current.currentTime = clamped;
      progress.reportPosition(clamped);
      progress.flush();
    },
    [duration, progress],
  );

  const handleComplete = React.useCallback(async () => {
    setPlaying(false);
    await progress.markComplete(true);
  }, [progress]);

  /* --- stand-in ticker --------------------------------------------------- */
  // Only runs when there is no real media element to emit timeupdate.
  React.useEffect(() => {
    if (src || !playing) return;

    const timer = window.setInterval(() => {
      setPosition((current) => {
        const next = current + 1;
        if (next >= duration) {
          window.clearInterval(timer);
          setPlaying(false);
          progress.reportPosition(duration);
          void progress.markComplete(true);
          return duration;
        }
        progress.reportPosition(next);
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [playing, src, duration, progress]);

  function togglePlay() {
    if (resumeOffered) setResumeOffered(false);

    if (src && videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        // A rejected play() is normal — autoplay policy, or no gesture yet.
        void videoRef.current.play().catch(() => setPlaying(false));
      }
      return;
    }
    setPlaying((current) => !current);
  }

  const percent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl border border-border bg-foreground/95">
        {src ? (
          <video
            ref={videoRef}
            className="aspect-video w-full"
            poster={poster ?? undefined}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={() => {
              // Restore the resume point before the first frame is shown.
              if (videoRef.current && initialPositionSeconds > 0) {
                videoRef.current.currentTime = initialPositionSeconds;
              }
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => {
              setPlaying(false);
              progress.flush();
            }}
            onSeeked={() => progress.flush()}
            onTimeUpdate={(event) => {
              const seconds = event.currentTarget.currentTime;
              setPosition(seconds);
              progress.reportPosition(seconds);
            }}
            onEnded={() => void handleComplete()}
          >
            <track kind="captions" />
          </video>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <Badge variant="warning" size="sm">
              Development placeholder
            </Badge>
            <p className="max-w-sm text-sm text-background/80">
              This deployment has no media pipeline, so no video file is attached. Rather than point
              at a URL that would not load, the lesson says so. The transport below is live —
              resume, progress and completion all work exactly as they will with real media.
            </p>
            <p className="font-mono text-2xl font-semibold text-background" data-numeric>
              {formatTimecode(position)} / {formatTimecode(duration)}
            </p>
          </div>
        )}
      </div>

      {/* --- resume prompt --------------------------------------------- */}
      {resumeOffered ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary-subtle p-3">
          <RotateCcw className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="flex-1 text-sm text-primary-subtle-foreground">
            You stopped at <strong data-numeric>{formatTimecode(initialPositionSeconds)}</strong>.
          </p>
          <Button
            size="sm"
            onClick={() => {
              seekTo(initialPositionSeconds);
              setResumeOffered(false);
              togglePlay();
            }}
          >
            Resume from {formatTimecode(initialPositionSeconds)}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              seekTo(0);
              setResumeOffered(false);
            }}
          >
            Start over
          </Button>
        </div>
      ) : null}

      {/* --- transport (stand-in only; real media uses native controls) -- */}
      {src ? null : (
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="outline"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>

          <label htmlFor="lesson-scrubber" className="sr-only">
            Playback position
          </label>
          <input
            id="lesson-scrubber"
            type="range"
            min={0}
            max={duration || 1}
            value={position}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            aria-valuetext={`${formatTimecode(position)} of ${formatTimecode(duration)}`}
          />

          <span
            className="shrink-0 font-mono text-2xs text-muted-foreground tabular-nums"
            data-numeric
          >
            {formatTimecode(position)} / {formatTimecode(duration)}
          </span>
        </div>
      )}

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label="Lesson progress"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {progress.saving ? "Saving progress…" : "Progress saves automatically"}
        </p>
        <Button
          variant={progress.completed ? "outline" : "primary"}
          size="sm"
          onClick={() => void progress.markComplete(!progress.completed)}
        >
          <Check
            className={cn("size-4", progress.completed && "text-success")}
            aria-hidden="true"
          />
          {progress.completed ? "Completed" : "Mark complete"}
        </Button>
      </div>
    </div>
  );
}

export { VideoLesson };
