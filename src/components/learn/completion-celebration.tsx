"use client";

import * as React from "react";
import Link from "next/link";
import { Award, PartyPopper, Sparkles } from "lucide-react";

import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { markCelebrated } from "@/lib/local-progress";

/**
 * Confetti, drawn on a canvas.
 *
 * Canvas rather than a library or hundreds of DOM nodes: a few hundred
 * rectangles animate in one paint, and this adds no dependency to a bundle
 * that only needs it once per course, ever.
 *
 * Runs for four seconds, then stops itself — it is a full-screen overlay, so
 * anything longer stops being celebratory and starts being in the way.
 */
const DURATION_MS = 4000;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
}

function ConfettiCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(dpr, dpr);

    // Brand palette, so the celebration belongs to this product.
    const colors = ["#0E7C6B", "#45BFA6", "#E0A458", "#C9723B", "#7FB8A8"];

    const pieces: Piece[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * width,
      // Start above the fold so they fall into view rather than popping in.
      y: Math.random() * -height * 0.5,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 2 + Math.random() * 2.6,
      size: 5 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.16,
      color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0]!,
    }));

    const start = performance.now();
    let frame = 0;

    function draw(now: number) {
      const elapsed = now - start;
      // Fade out over the last second rather than vanishing mid-fall.
      const fade = elapsed > DURATION_MS - 1000 ? 1 - (elapsed - (DURATION_MS - 1000)) / 1000 : 1;

      context!.clearRect(0, 0, width, height);
      context!.globalAlpha = Math.max(0, fade);

      for (const piece of pieces) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.spin;

        if (piece.y > height + 20) {
          piece.y = -20;
          piece.x = Math.random() * width;
        }

        context!.save();
        context!.translate(piece.x, piece.y);
        context!.rotate(piece.rotation);
        context!.fillStyle = piece.color;
        context!.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        context!.restore();
      }

      if (elapsed < DURATION_MS) {
        frame = requestAnimationFrame(draw);
      } else {
        context!.clearRect(0, 0, width, height);
      }
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}

/**
 * Shown once, on the request that actually completes the course.
 *
 * Two separate guards stop it repeating: the server only reports
 * `justCompleted` on the transition itself, and this component records the
 * course in `localStorage` so a reload of that same response is silent.
 */
function CompletionCelebration({
  open,
  onOpenChange,
  courseId,
  courseTitle,
  certificateSerial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  certificateSerial: string | null;
}) {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
  }, []);

  React.useEffect(() => {
    if (open) markCelebrated(courseId);
  }, [open, courseId]);

  return (
    <>
      {open && !reducedMotion ? <ConfettiCanvas /> : null}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary-subtle text-primary-subtle-foreground">
              <PartyPopper className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle>You finished {courseTitle}</DialogTitle>
            <DialogDescription>
              Every required lesson is done. That is the hard part — most people who start a course
              never reach this screen.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="sm:flex-col">
            <Button fullWidth asChild>
              <Link href={certificateSerial ? routes.certificates : routes.certificates}>
                <Award aria-hidden="true" />
                {certificateSerial ? "View your certificate" : "Get your certificate"}
              </Link>
            </Button>
            <Button variant="outline" fullWidth asChild>
              <Link href={routes.courses}>
                <Sparkles aria-hidden="true" />
                Find your next course
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { CompletionCelebration, ConfettiCanvas };
