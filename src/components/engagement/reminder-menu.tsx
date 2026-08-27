"use client";

import * as React from "react";
import { formatDateTime } from "@/lib/format";
import { BellOff, BellRing, Check, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import {
  deliverDueRemindersAction,
  setCourseReminderAction,
  type ReminderChoice,
} from "@/features/engagement/actions";

/**
 * Course reminders.
 *
 * Two things are worth being explicit about.
 *
 * **Permission is only ever requested after a deliberate choice.** Browsers
 * penalise sites that prompt on load, and a permission dialog nobody asked for
 * is rejected on reflex. `Notification.requestPermission()` runs inside the
 * click handler, not in an effect.
 *
 * **The browser timer is a convenience, not the mechanism.** `setTimeout` dies
 * with the tab and never fires on a sleeping device. The durable record is the
 * `CourseReminder` row with its `nextRunAt`, which a server-side scheduler
 * will select on later; the timer below merely delivers early for a session
 * that happens to still be open.
 */

const OPTIONS: Array<{ value: ReminderChoice; label: string; hint: string }> = [
  { value: "in-1-hour", label: "Remind me in 1 hour", hint: "A nudge later today" },
  { value: "tomorrow", label: "Remind me tomorrow", hint: "Same time, next day" },
  { value: "none", label: "No reminders", hint: "Clear any reminder for this course" },
];

function ReminderMenu({
  courseId,
  courseTitle,
  initialNextRunAt,
}: {
  courseId: string;
  courseTitle: string;
  /** ISO 8601 of an existing reminder, if one is set. */
  initialNextRunAt?: string | null;
}) {
  const [nextRunAt, setNextRunAt] = React.useState<string | null>(initialNextRunAt ?? null);
  const [pending, setPending] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  /** Schedules a best-effort in-session delivery. */
  const scheduleLocalTimer = React.useCallback(
    (runAt: string) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);

      const delay = Date.parse(runAt) - Date.now();
      // setTimeout overflows past ~24.8 days and fires immediately; anything
      // that far out belongs to the server scheduler regardless.
      if (delay <= 0 || delay > 2_147_483_647) return;

      timerRef.current = window.setTimeout(() => {
        void deliverDueRemindersAction().then((result) => {
          if (!result.ok || !result.data?.delivered) return;

          // A browser notification only if permission was actually granted.
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification("Time to learn", {
                body: `You asked to be reminded about ${courseTitle}.`,
                tag: `lumen-reminder-${courseId}`,
              });
            } catch {
              // Some browsers refuse constructor notifications outside a
              // service worker. The in-app notification is already recorded.
            }
          }

          toast("Reminder", { description: `Time to get back to ${courseTitle}.` });
          setNextRunAt(null);
        });
      }, delay);
    },
    [courseId, courseTitle],
  );

  React.useEffect(() => {
    if (nextRunAt) scheduleLocalTimer(nextRunAt);
  }, [nextRunAt, scheduleLocalTimer]);

  async function choose(choice: ReminderChoice) {
    setPending(true);

    // The permission prompt happens here — inside the click, and only when the
    // learner has actually asked for a reminder.
    if (choice !== "none" && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch {
          // Denied or unsupported. The reminder is still recorded and will
          // appear in the notification centre.
        }
      }
    }

    const result = await setCourseReminderAction({ courseId, choice });
    setPending(false);

    if (!result.ok) {
      toast.error(result.message ?? "That reminder could not be saved.");
      return;
    }

    setNextRunAt(result.data?.nextRunAt ?? null);

    if (choice === "none") {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      toast("Reminders off", { description: `No more reminders for ${courseTitle}.` });
      return;
    }

    const when = choice === "in-1-hour" ? "in an hour" : "tomorrow";
    const denied = typeof Notification !== "undefined" && Notification.permission === "denied";

    toast.success(`Reminder set for ${when}`, {
      description: denied
        ? "Browser notifications are blocked, so it will appear in your notification centre instead."
        : "You will get a nudge here and in your notifications.",
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {nextRunAt ? (
            <>
              <BellRing aria-hidden="true" />
              Reminder set
            </>
          ) : (
            <>
              <Clock3 aria-hidden="true" />
              Remind me
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Study reminder</DropdownMenuLabel>

        {nextRunAt ? (
          <>
            <div className="px-2 py-1.5">
              <Badge variant="primary" size="sm">
                {formatDateTime(nextRunAt)}
              </Badge>
            </div>
            <DropdownMenuSeparator />
          </>
        ) : null}

        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            variant={option.value === "none" ? "danger" : "default"}
            onSelect={(event) => {
              event.preventDefault();
              void choose(option.value);
            }}
          >
            {option.value === "none" ? (
              <BellOff aria-hidden="true" />
            ) : nextRunAt ? (
              <Check aria-hidden="true" />
            ) : (
              <Clock3 aria-hidden="true" />
            )}
            <span className="flex flex-col">
              <span>{option.label}</span>
              <span className="text-2xs text-muted-foreground">{option.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-sm text-muted-foreground">
          Reminders are saved to your account, so they are not lost if you close this tab.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ReminderMenu };
