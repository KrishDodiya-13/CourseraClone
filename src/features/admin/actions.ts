"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { assertAdmin, AuthorizationError } from "@/server/authz";
import { routes } from "@/lib/routes";
import { notify } from "@/features/engagement/notify";
import { recordAdminAction } from "@/features/admin/audit";
import { countActiveAdmins } from "@/features/admin/users";

/**
 * Administrative mutations.
 *
 * **Every action in this file calls `assertAdmin()` as its first act, and none
 * of them rely on the `/admin` layout having done so.** That is not belt and
 * braces — a Server Action is its own POST endpoint. It is reachable by its
 * action id from any page, by any signed-in user, without ever rendering the
 * layout whose `requireAdmin` supposedly guards it. A guard in the layout
 * protects the *view*; only the check below protects the *change*.
 *
 * Nothing here accepts a role, a status or a permission claim from the client.
 * The client sends an id and an intent; the server decides whether that intent
 * is allowed, then writes the audit row in the same transaction as the change.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

function fail(message: string): ActionResult<never> {
  return { ok: false, message };
}

/**
 * Runs an admin action, turning an authorization failure into a message.
 *
 * Wrapping this once means no individual action can accidentally omit the
 * check or leak an internal error message to the client.
 */
async function withAdmin<T>(
  run: (actor: { id: string; name: string }) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  let actor;
  try {
    actor = await assertAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // Deliberately identical for "not signed in" and "not an admin". Telling
      // a signed-in user that admin actions exist here is information they do
      // not need.
      return fail("You do not have permission to do that.");
    }
    throw error;
  }

  try {
    return await run({ id: actor.id, name: actor.name });
  } catch (error) {
    console.error("[admin] action failed", error);
    return fail("Something went wrong. The change was not saved.");
  }
}

/* ========================================================================== */
/*  Users                                                                     */
/* ========================================================================== */

const roleSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]),
});

/**
 * Changes a user's role.
 *
 * Two refusals are built in, and both exist to stop the console locking
 * everyone out of itself:
 *
 *  - an admin cannot change their own role, because the usual way this goes
 *    wrong is a misclick on your own row;
 *  - the last remaining active admin cannot be demoted, because there would
 *    then be no account able to undo it.
 */
export async function setUserRoleAction(input: {
  userId: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}): Promise<ActionResult> {
  return withAdmin(async (actor) => {
    const parsed = roleSchema.safeParse(input);
    if (!parsed.success) return fail("That is not a role we recognise.");

    const { userId, role } = parsed.data;

    if (userId === actor.id) {
      return fail("You cannot change your own role. Ask another admin.");
    }

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    if (!target) return fail("That account no longer exists.");
    if (target.role === role) return { ok: true, message: `${target.name} is already ${role}.` };

    if (target.role === "ADMIN" && (await countActiveAdmins()) <= 1) {
      return fail("This is the last active admin. Promote someone else first.");
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { role } });

      // Promoting to instructor creates the profile the studio needs; the
      // alternative is an instructor with no way to be found or credited.
      if (role === "INSTRUCTOR") {
        const existing = await tx.instructorProfile.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!existing) {
          await tx.instructorProfile.create({
            data: {
              userId,
              slug: await uniqueInstructorSlug(tx, target.name, userId),
              headline: `Instructor at Coursera`,
              expertise: [],
              approvedAt: new Date(),
            },
          });
        }
      }

      await recordAdminAction(
        {
          actorId: actor.id,
          action: "ROLE_CHANGE",
          entityType: "User",
          entityId: userId,
          metadata: { name: target.name, email: target.email, from: target.role, to: role },
        },
        tx,
      );
    });

    await notify({
      userId,
      type: "ACCOUNT",
      title: "Your account role changed",
      body: `An administrator changed your role to ${role.toLowerCase()}.`,
      href: routes.profile,
      dedupeKey: `role-change:${userId}:${role}:${Date.now()}`,
    });

    revalidatePath(routes.adminUsers);
    return { ok: true, message: `${target.name} is now ${role.toLowerCase()}.` };
  });
}

/** Derives a free instructor slug, falling back to the user id on collision. */
async function uniqueInstructorSlug(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  name: string,
  userId: string,
): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "instructor";

  const taken = await tx.instructorProfile.findUnique({
    where: { slug: base },
    select: { id: true },
  });
  return taken ? `${base}-${userId.slice(-6)}` : base;
}

const statusSchema = z.object({
  userId: z.string().min(1).max(64),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
  reason: z.string().trim().max(280).optional(),
});

/**
 * Suspends, deactivates or reinstates an account.
 *
 * Suspension does not delete anything. Enrolments, certificates and orders all
 * survive it, because a suspension is a decision that may be reversed and the
 * learner's history is not the platform's to discard.
 */
export async function setUserStatusAction(input: {
  userId: string;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  reason?: string;
}): Promise<ActionResult> {
  return withAdmin(async (actor) => {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) return fail("That is not a status we recognise.");

    const { userId, status, reason } = parsed.data;

    if (userId === actor.id) {
      return fail("You cannot suspend your own account.");
    }

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    if (!target) return fail("That account no longer exists.");
    if (target.status === status) {
      return { ok: true, message: `${target.name} is already ${status.toLowerCase()}.` };
    }

    if (target.role === "ADMIN" && status !== "ACTIVE" && (await countActiveAdmins()) <= 1) {
      return fail("This is the last active admin. Promote someone else first.");
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status } });

      await recordAdminAction(
        {
          actorId: actor.id,
          action: status === "ACTIVE" ? "REINSTATE" : "SUSPEND",
          entityType: "User",
          entityId: userId,
          metadata: {
            name: target.name,
            email: target.email,
            from: target.status,
            to: status,
            ...(reason ? { reason } : {}),
          },
        },
        tx,
      );
    });

    await notify({
      userId,
      type: "ACCOUNT",
      title: status === "ACTIVE" ? "Your account was reinstated" : "Your account was suspended",
      body:
        status === "ACTIVE"
          ? "You can sign in and carry on where you left off."
          : reason || "Contact support if you believe this is a mistake.",
      href: routes.profile,
      dedupeKey: `status-change:${userId}:${status}:${Date.now()}`,
    });

    revalidatePath(routes.adminUsers);
    return {
      ok: true,
      message:
        status === "ACTIVE"
          ? `${target.name} was reinstated.`
          : `${target.name} was ${status.toLowerCase()}.`,
    };
  });
}

/* ========================================================================== */
/*  Course moderation                                                         */
/* ========================================================================== */

const moderationSchema = z.object({
  courseId: z.string().min(1).max(64),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"]),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Moves a course between moderation states.
 *
 * Unpublishing removes a course from the catalogue; it does **not** revoke the
 * enrolments of people who already paid for it. Taking a course off sale and
 * taking it away from its buyers are different decisions, and only the first
 * one is being made here.
 */
export async function setCourseStatusAction(input: {
  courseId: string;
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  reason?: string;
}): Promise<ActionResult> {
  return withAdmin(async (actor) => {
    const parsed = moderationSchema.safeParse(input);
    if (!parsed.success) return fail("That is not a status we recognise.");

    const { courseId, status, reason } = parsed.data;

    if (status === "REJECTED" && !reason) {
      return fail("Give a reason so the instructor knows what to fix.");
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        publishedAt: true,
        lessonCount: true,
        instructors: {
          where: { role: "OWNER" },
          take: 1,
          select: { userId: true },
        },
      },
    });
    if (!course) return fail("That course no longer exists.");
    if (course.status === status) {
      return { ok: true, message: `“${course.title}” is already ${label(status)}.` };
    }

    if (status === "PUBLISHED" && course.lessonCount === 0) {
      return fail("A course with no lessons cannot be published.");
    }

    const ownerId = course.instructors[0]?.userId ?? null;
    const wasPublished = course.status === "PUBLISHED";
    const nowPublished = status === "PUBLISHED";

    await db.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: courseId },
        data: {
          status,
          // The first publication stamps the date; a later republish keeps the
          // original, because "published on" is when learners first saw it.
          publishedAt: nowPublished ? (course.publishedAt ?? new Date()) : course.publishedAt,
          // A rejection reason belongs to the rejection. Leaving a stale one on
          // a since-approved course would show the instructor an old refusal.
          rejectionReason: status === "REJECTED" ? (reason ?? null) : null,
        },
      });

      // The instructor's public course count is read on their profile card, so
      // it is recomputed whenever visibility changes rather than incremented.
      if (ownerId && wasPublished !== nowPublished) {
        const profile = await tx.instructorProfile.findUnique({
          where: { userId: ownerId },
          select: { id: true },
        });
        if (profile) {
          const live = await tx.course.count({
            where: {
              status: "PUBLISHED",
              deletedAt: null,
              instructors: { some: { userId: ownerId, role: "OWNER" } },
            },
          });
          await tx.instructorProfile.update({
            where: { id: profile.id },
            data: { courseCount: live },
          });
        }
      }

      await recordAdminAction(
        {
          actorId: actor.id,
          action: auditActionFor(course.status, status),
          entityType: "Course",
          entityId: courseId,
          metadata: {
            name: course.title,
            slug: course.slug,
            from: course.status,
            to: status,
            ...(reason ? { reason } : {}),
          },
        },
        tx,
      );
    });

    if (ownerId) {
      await notify({
        userId: ownerId,
        type: nowPublished ? "COURSE_PUBLISHED" : "ACCOUNT",
        title: nowPublished ? "Your course is live" : `Your course is now ${label(status)}`,
        body: nowPublished
          ? `“${course.title}” is published and visible in the catalogue.`
          : reason || `An administrator moved “${course.title}” to ${label(status)}.`,
        href: nowPublished ? routes.course(course.slug) : routes.studioCourses,
        dedupeKey: `course-status:${courseId}:${status}:${Date.now()}`,
      });
    }

    revalidatePath(routes.adminCourses);
    revalidatePath(routes.courses);
    revalidatePath(routes.course(course.slug));

    return { ok: true, message: `“${course.title}” is now ${label(status)}.` };
  });
}

function label(status: string): string {
  return status.toLowerCase().replace("_", " ");
}

/** Picks the audit verb that describes the transition, not just the end state. */
function auditActionFor(
  from: string,
  to: string,
): "PUBLISH" | "UNPUBLISH" | "APPROVE" | "REJECT" | "UPDATE" {
  if (to === "PUBLISHED") return from === "IN_REVIEW" ? "APPROVE" : "PUBLISH";
  if (to === "REJECTED") return "REJECT";
  if (from === "PUBLISHED") return "UNPUBLISH";
  return "UPDATE";
}

/* ========================================================================== */
/*  Categories                                                                */
/* ========================================================================== */

const ICON_KEYS = [
  "code",
  "chart",
  "brain",
  "palette",
  "briefcase",
  "megaphone",
  "shield",
  "camera",
] as const;

const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."),
  description: z.string().trim().min(10).max(300),
  iconKey: z.enum(ICON_KEYS),
  parentId: z.string().max(64).optional(),
});

export async function createCategoryAction(input: {
  name: string;
  slug: string;
  description: string;
  iconKey: string;
  parentId?: string;
}): Promise<ActionResult> {
  return withAdmin(async (actor) => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Check the category details.");
    }

    const { name, slug, description, iconKey, parentId } = parsed.data;

    const clash = await db.category.findUnique({ where: { slug }, select: { id: true } });
    if (clash) return fail(`The slug “${slug}” is already in use.`);

    // New categories go to the end. Inserting in the middle would silently
    // renumber everything else, which is a reorder, not a create.
    const last = await db.category.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const created = await db.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name,
          slug,
          description,
          iconKey,
          parentId: parentId || null,
          position: (last?.position ?? -1) + 1,
        },
        select: { id: true, name: true },
      });

      await recordAdminAction(
        {
          actorId: actor.id,
          action: "CREATE",
          entityType: "Category",
          entityId: category.id,
          metadata: { name, slug },
        },
        tx,
      );

      return category;
    });

    revalidatePath(routes.adminCategories);
    revalidatePath(routes.categories);
    return { ok: true, message: `“${created.name}” was created.` };
  });
}

export async function updateCategoryAction(input: {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconKey: string;
  parentId?: string;
}): Promise<ActionResult> {
  return withAdmin(async (actor) => {
    const parsed = categorySchema.extend({ id: z.string().min(1).max(64) }).safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Check the category details.");
    }

    const { id, name, slug, description, iconKey, parentId } = parsed.data;

    const existing = await db.category.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!existing) return fail("That category no longer exists.");

    if (parentId === id) return fail("A category cannot be its own parent.");

    const clash = await db.category.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== id) return fail(`The slug “${slug}” is already in use.`);

    await db.$transaction(async (tx) => {
      await tx.category.update({
        where: { id },
        data: { name, slug, description, iconKey, parentId: parentId || null },
      });

      await recordAdminAction(
        {
          actorId: actor.id,
          action: "UPDATE",
          entityType: "Category",
          entityId: id,
          metadata: {
            name,
            ...(existing.slug !== slug ? { from: existing.slug, to: slug } : {}),
          },
        },
        tx,
      );
    });

    revalidatePath(routes.adminCategories);
    revalidatePath(routes.categories);
    return { ok: true, message: `“${name}” was updated.` };
  });
}

/**
 * Deletes an empty category.
 *
 * The foreign key from `courses` is `onDelete: Restrict`, so the database would
 * refuse this anyway — but it would refuse it as a constraint violation, which
 * surfaces to the admin as an unexplained failure. Checking first turns that
 * into a sentence they can act on.
 */
export async function deleteCategoryAction(input: { id: string }): Promise<ActionResult> {
  return withAdmin(async (actor) => {
    const id = z.string().min(1).max(64).safeParse(input.id);
    if (!id.success) return fail("That category no longer exists.");

    const category = await db.category.findUnique({
      where: { id: id.data },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { courses: true, children: true } },
      },
    });
    if (!category) return fail("That category no longer exists.");

    if (category._count.courses > 0) {
      return fail(
        `“${category.name}” still holds ${category._count.courses} course${
          category._count.courses === 1 ? "" : "s"
        }. Move them first.`,
      );
    }

    if (category._count.children > 0) {
      return fail(`“${category.name}” still has sub-categories. Remove those first.`);
    }

    await db.$transaction(async (tx) => {
      await tx.category.delete({ where: { id: category.id } });

      // The audit row is written first in the same transaction and outlives the
      // row it describes — deleting the thing must not delete the record of it.
      await recordAdminAction(
        {
          actorId: actor.id,
          action: "DELETE",
          entityType: "Category",
          entityId: category.id,
          metadata: { name: category.name, slug: category.slug },
        },
        tx,
      );
    });

    revalidatePath(routes.adminCategories);
    revalidatePath(routes.categories);
    return { ok: true, message: `“${category.name}” was deleted.` };
  });
}

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1).max(64)).min(1).max(200),
});

/**
 * Rewrites category order.
 *
 * The client sends the full ordered list rather than "move item up", so the
 * result is the same whatever order the requests arrive in — two admins
 * dragging at once end with one of the two layouts, never an interleaved
 * half of each. Positions are renumbered from zero inside one transaction, so
 * nobody ever reads a half-applied ordering.
 */
export async function reorderCategoriesAction(input: {
  orderedIds: string[];
}): Promise<ActionResult> {
  return withAdmin(async (actor) => {
    const parsed = reorderSchema.safeParse(input);
    if (!parsed.success) return fail("That ordering is not valid.");

    const { orderedIds } = parsed.data;

    const existing = await db.category.findMany({ select: { id: true } });
    const known = new Set(existing.map((row) => row.id));

    if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
      // A partial list would leave the omitted categories at stale positions,
      // colliding with the renumbered ones. Refusing is better than guessing.
      return fail("The category list changed. Reload and try again.");
    }

    await db.$transaction(async (tx) => {
      for (const [index, id] of orderedIds.entries()) {
        await tx.category.update({ where: { id }, data: { position: index } });
      }

      await recordAdminAction(
        {
          actorId: actor.id,
          action: "UPDATE",
          entityType: "Category",
          entityId: "*",
          metadata: { name: "Category order", to: `${orderedIds.length} categories reordered` },
        },
        tx,
      );
    });

    revalidatePath(routes.adminCategories);
    revalidatePath(routes.categories);
    revalidatePath(routes.home);
    return { ok: true, message: "Order saved." };
  });
}
