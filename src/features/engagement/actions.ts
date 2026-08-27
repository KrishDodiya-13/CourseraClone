"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { assertAuth, AuthorizationError } from "@/server/authz";
import { routes } from "@/lib/routes";

/**
 * Engagement mutations: reading notifications, and setting course reminders.
 *
 * Every one scopes its write by `userId` in the `where` clause rather than
 * looking a row up and then checking it — an update that matches zero rows is
 * a safer failure than one that matched and was rejected afterwards.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

/* -------------------------------------------------------------------------- */
/*  Notifications                                                             */
/* -------------------------------------------------------------------------- */

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false };
    throw error;
  }

  // Scoped by userId, so a guessed id belonging to someone else updates
  // nothing at all.
  await db.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath(routes.notifications);
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false };
    throw error;
  }

  const result = await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath(routes.notifications);
  revalidatePath(routes.dashboard);
  return { ok: true, data: { count: result.count } };
}

/* -------------------------------------------------------------------------- */
/*  Course reminders                                                          */
/* -------------------------------------------------------------------------- */

export type ReminderChoice = "in-1-hour" | "tomorrow" | "none";

const reminderSchema = z.object({
  courseId: z.string().min(1),
  choice: z.enum(["in-1-hour", "tomorrow", "none"]),
});

/**
 * Sets or clears a reminder for one course.
 *
 * The `CourseReminder` row is the durable record, and `nextRunAt` is the field
 * a server-side scheduler will select on. That matters: a browser timer stops
 * when the tab closes and never fires on a sleeping device, so the row has to
 * carry enough for something else to deliver the reminder later. The client
 * timer added on top is a best-effort convenience for a session that happens
 * to still be open — not the mechanism.
 */
export async function setCourseReminderAction(input: {
  courseId: string;
  choice: ReminderChoice;
}): Promise<ActionResult<{ nextRunAt: string | null }>> {
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That reminder is not valid." };

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: "Sign in to set a reminder." };
    }
    throw error;
  }

  // A reminder is only meaningful for a course the learner actually holds.
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: parsed.data.courseId } },
    select: { status: true },
  });

  if (!enrollment || (enrollment.status !== "ACTIVE" && enrollment.status !== "COMPLETED")) {
    return { ok: false, message: "You are not enrolled in this course." };
  }

  // Clearing: deactivate rather than delete, so the history of what someone
  // asked for is not silently erased.
  if (parsed.data.choice === "none") {
    await db.courseReminder.updateMany({
      where: { userId: user.id, courseId: parsed.data.courseId, isActive: true },
      data: { isActive: false, nextRunAt: null },
    });
    revalidatePath(routes.dashboard);
    return { ok: true, data: { nextRunAt: null } };
  }

  const nextRunAt = new Date();
  if (parsed.data.choice === "in-1-hour") {
    nextRunAt.setHours(nextRunAt.getHours() + 1);
  } else {
    nextRunAt.setDate(nextRunAt.getDate() + 1);
  }

  const user_ = await db.user.findUnique({
    where: { id: user.id },
    select: { timezone: true },
  });

  await db.$transaction(async (tx) => {
    // One active reminder per course. Choosing again replaces the previous
    // choice rather than stacking a second alarm.
    await tx.courseReminder.updateMany({
      where: { userId: user.id, courseId: parsed.data.courseId, isActive: true },
      data: { isActive: false, nextRunAt: null },
    });

    await tx.courseReminder.create({
      data: {
        userId: user.id,
        courseId: parsed.data.courseId,
        // CUSTOM: a one-off nudge, not a recurring schedule.
        frequency: "CUSTOM",
        timeOfDay: `${String(nextRunAt.getHours()).padStart(2, "0")}:${String(
          nextRunAt.getMinutes(),
        ).padStart(2, "0")}`,
        timezone: user_?.timezone ?? "UTC",
        daysOfWeek: [],
        isActive: true,
        nextRunAt,
      },
    });
  });

  revalidatePath(routes.dashboard);
  return { ok: true, data: { nextRunAt: nextRunAt.toISOString() } };
}

/**
 * Creates the in-app notification for a reminder that has come due.
 *
 * Exposed as an action so the client timer can fire it for an open session.
 * The same function is what a server-side scheduler will call in future — it
 * re-reads the reminder and refuses to fire one that is not yet due, so a
 * tampered client cannot make it deliver early or repeatedly.
 */
export async function deliverDueRemindersAction(): Promise<ActionResult<{ delivered: number }>> {
  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false };
    throw error;
  }

  const due = await db.courseReminder.findMany({
    where: {
      userId: user.id,
      isActive: true,
      nextRunAt: { not: null, lte: new Date() },
    },
    select: {
      id: true,
      courseId: true,
      course: { select: { title: true, slug: true } },
    },
  });

  if (due.length === 0) return { ok: true, data: { delivered: 0 } };

  for (const reminder of due) {
    await db.$transaction(async (tx) => {
      await tx.notification.create({
        data: {
          userId: user.id,
          type: "STUDY_REMINDER",
          title: "Time to learn",
          body: reminder.course
            ? `You asked to be reminded about ${reminder.course.title}.`
            : "You asked to be reminded to study.",
          href: reminder.course ? routes.learn(reminder.course.slug) : routes.dashboard,
          dedupeKey: `reminder:${reminder.id}`,
        },
      });

      // A one-off reminder is spent once delivered.
      await tx.courseReminder.update({
        where: { id: reminder.id },
        data: { isActive: false, nextRunAt: null, lastSentAt: new Date() },
      });
    });
  }

  revalidatePath(routes.notifications);
  return { ok: true, data: { delivered: due.length } };
}
