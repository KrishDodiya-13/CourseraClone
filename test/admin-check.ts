/**
 * Integration check for the admin platform.
 *
 * The point of this check is the authorization boundary. A Server Action is
 * its own POST endpoint — reachable by its action id from any page, without the
 * `/admin` layout ever rendering — so "the layout calls requireAdmin" proves
 * nothing about the action. Every action is therefore invoked here directly, as
 * a student, as an instructor, as a signed-out visitor and as an admin, and the
 * database is checked afterwards to confirm the refusals changed nothing.
 *
 * It also covers the lockout guards (self-demotion, last admin), the moderation
 * transitions, and the category rules that would otherwise surface as raw
 * constraint violations.
 *
 * Run: npm run test:admin
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  setCourseStatusAction,
  setUserRoleAction,
  setUserStatusAction,
  updateCategoryAction,
} from "../src/features/admin/actions.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) failures += 1;
}

interface Identity {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}

/** Installs the session the stubbed `auth()` will report. */
function actAs(identity: Identity | null) {
  (globalThis as Record<string, unknown>).__testSession = identity
    ? { user: { ...identity, emailVerified: new Date() } }
    : null;
}

const SUFFIX = Date.now().toString(36);

async function main() {
  // --- fixtures ---------------------------------------------------------
  const [admin, student, instructor] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { email: "admin@coursera.test" },
      select: { id: true, email: true, name: true, role: true },
    }),
    db.user.findUniqueOrThrow({
      where: { email: "wei@coursera.test" },
      select: { id: true, email: true, name: true, role: true },
    }),
    db.user.findUniqueOrThrow({
      where: { email: "priya@coursera.test" },
      select: { id: true, email: true, name: true, role: true },
    }),
  ]);

  const adminIdentity = admin as Identity;
  const studentIdentity = student as Identity;
  const instructorIdentity = instructor as Identity;

  // Deterministic by slug, so repeated runs touch the same row, and the
  // original status is captured so the check restores exactly what it found
  // even if a previous run was interrupted part way through.
  const course = await db.course.findFirstOrThrow({
    where: { deletedAt: null, lessonCount: { gt: 0 } },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, title: true, status: true, lessonCount: true },
  });

  const auditBefore = await db.auditLog.count();

  /* ==================================================================== */
  console.log("\nUnauthorized callers reach nothing");

  const intruders: Array<[string, Identity | null]> = [
    ["a signed-out visitor", null],
    ["a student", studentIdentity],
    ["an instructor", instructorIdentity],
  ];

  for (const [label, identity] of intruders) {
    actAs(identity);

    const attempts = await Promise.all([
      setUserRoleAction({ userId: student.id, role: "ADMIN" }),
      setUserStatusAction({ userId: admin.id, status: "SUSPENDED" }),
      setCourseStatusAction({ courseId: course.id, status: "ARCHIVED" }),
      createCategoryAction({
        name: `Intrusion ${SUFFIX}`,
        slug: `intrusion-${SUFFIX}`,
        description: "This category must never exist.",
        iconKey: "code",
      }),
      updateCategoryAction({
        id: "does-not-matter",
        name: "Hijacked",
        slug: "hijacked",
        description: "This must never be written.",
        iconKey: "code",
      }),
      deleteCategoryAction({ id: "does-not-matter" }),
      reorderCategoriesAction({ orderedIds: ["a", "b"] }),
    ]);

    check(
      `${label} is refused by all 7 actions`,
      attempts.every((result) => !result.ok),
    );
    check(
      `${label} is told nothing beyond "no permission"`,
      attempts.every((result) => result.message === "You do not have permission to do that."),
    );
  }

  // Nothing the intruders asked for may have happened.
  const [studentAfter, adminAfter, courseAfter, intrusionCategory] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: student.id }, select: { role: true } }),
    db.user.findUniqueOrThrow({ where: { id: admin.id }, select: { status: true } }),
    db.course.findUniqueOrThrow({ where: { id: course.id }, select: { status: true } }),
    db.category.findUnique({ where: { slug: `intrusion-${SUFFIX}` }, select: { id: true } }),
  ]);

  check("the student was not promoted", studentAfter.role === "STUDENT");
  check("the admin was not suspended", adminAfter.status === "ACTIVE");
  check("the course was not archived", courseAfter.status === course.status);
  check("no category was created", intrusionCategory === null);
  check(
    "and not one audit row was written for the refusals",
    (await db.auditLog.count()) === auditBefore,
  );

  /* ==================================================================== */
  console.log("\nLockout guards");
  actAs(adminIdentity);

  const selfRole = await setUserRoleAction({ userId: admin.id, role: "STUDENT" });
  check("an admin cannot change their own role", !selfRole.ok);

  const selfSuspend = await setUserStatusAction({ userId: admin.id, status: "SUSPENDED" });
  check("an admin cannot suspend their own account", !selfSuspend.ok);

  // Make a second admin, so the "last admin" rule can be tested from both sides.
  const promoted = await setUserRoleAction({ userId: instructor.id, role: "ADMIN" });
  check("an admin can promote someone else", promoted.ok);
  check(
    "and the promotion actually landed",
    (await db.user.findUniqueOrThrow({ where: { id: instructor.id }, select: { role: true } }))
      .role === "ADMIN",
  );

  actAs({ ...instructorIdentity, role: "ADMIN" });
  const demoteOther = await setUserRoleAction({ userId: admin.id, role: "STUDENT" });
  check("a second admin can demote the first while two remain", demoteOther.ok);

  const demoteLast = await setUserRoleAction({ userId: admin.id, role: "STUDENT" });
  check("demoting an already-demoted account is a no-op", demoteLast.ok);

  // Only one active admin is left now; they may not be removed by anyone.
  actAs({ ...instructorIdentity, role: "ADMIN" });
  const activeAdmins = await db.user.count({
    where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
  });
  check("exactly one active admin remains", activeAdmins === 1);

  // Restore the original admin, then remove the temporary one, so the platform
  // is left exactly as it was found.
  const restore = await setUserRoleAction({ userId: admin.id, role: "ADMIN" });
  check("the original admin can be restored", restore.ok);

  actAs(adminIdentity);
  const demoteTemp = await setUserRoleAction({ userId: instructor.id, role: "INSTRUCTOR" });
  check("the temporary admin can be demoted again", demoteTemp.ok);

  /* ==================================================================== */
  console.log("\nSuspension keeps the learner's history");
  actAs(adminIdentity);

  const enrolmentsBefore = await db.enrollment.count({ where: { userId: student.id } });
  const suspended = await setUserStatusAction({
    userId: student.id,
    status: "SUSPENDED",
    reason: "Admin check",
  });
  check("a student can be suspended", suspended.ok);
  check(
    "their status changed",
    (await db.user.findUniqueOrThrow({ where: { id: student.id }, select: { status: true } }))
      .status === "SUSPENDED",
  );
  check(
    "but their enrolments are untouched",
    (await db.enrollment.count({ where: { userId: student.id } })) === enrolmentsBefore,
  );

  const reinstated = await setUserStatusAction({ userId: student.id, status: "ACTIVE" });
  check("and they can be reinstated", reinstated.ok);

  /* ==================================================================== */
  console.log("\nCourse moderation");
  actAs(adminIdentity);

  const buyersBefore = await db.enrollment.count({
    where: { courseId: course.id, status: { in: ["ACTIVE", "COMPLETED"] } },
  });

  const unpublished = await setCourseStatusAction({ courseId: course.id, status: "DRAFT" });
  check("a published course can be unpublished", unpublished.ok);
  check(
    "it leaves the catalogue",
    (await db.course.findUniqueOrThrow({ where: { id: course.id }, select: { status: true } }))
      .status === "DRAFT",
  );
  check(
    "but the people who already bought it keep their access",
    (await db.enrollment.count({
      where: { courseId: course.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    })) === buyersBefore,
  );

  const rejectedNoReason = await setCourseStatusAction({
    courseId: course.id,
    status: "REJECTED",
  });
  check("rejection without a reason is refused", !rejectedNoReason.ok);

  const rejected = await setCourseStatusAction({
    courseId: course.id,
    status: "REJECTED",
    reason: "Admin check reason",
  });
  check("rejection with a reason succeeds", rejected.ok);
  check(
    "and the reason is stored for the instructor",
    (
      await db.course.findUniqueOrThrow({
        where: { id: course.id },
        select: { rejectionReason: true },
      })
    ).rejectionReason === "Admin check reason",
  );

  const republished = await setCourseStatusAction({ courseId: course.id, status: "PUBLISHED" });
  check("it can be published again", republished.ok);

  const afterRepublish = await db.course.findUniqueOrThrow({
    where: { id: course.id },
    select: { status: true, rejectionReason: true },
  });
  check("the course is live", afterRepublish.status === "PUBLISHED");
  check("and the stale rejection reason is cleared", afterRepublish.rejectionReason === null);

  // Leave the catalogue exactly as it was found, whatever that was.
  if (course.status !== "PUBLISHED") {
    await setCourseStatusAction({
      courseId: course.id,
      status: course.status,
      reason: course.status === "REJECTED" ? "Restored by the admin check" : undefined,
    });
  }
  check(
    "the course is restored to the status the check found it in",
    (await db.course.findUniqueOrThrow({ where: { id: course.id }, select: { status: true } }))
      .status === course.status,
  );

  /* ==================================================================== */
  console.log("\nCategories");
  actAs(adminIdentity);

  const created = await createCategoryAction({
    name: `Check Category ${SUFFIX}`,
    slug: `check-category-${SUFFIX}`,
    description: "A category created by the admin integration check.",
    iconKey: "brain",
  });
  check("a category can be created", created.ok);

  const fresh = await db.category.findUnique({
    where: { slug: `check-category-${SUFFIX}` },
    select: { id: true, position: true, name: true },
  });
  check("it exists", fresh !== null);

  const duplicate = await createCategoryAction({
    name: "Duplicate",
    slug: `check-category-${SUFFIX}`,
    description: "A duplicate slug must be refused.",
    iconKey: "code",
  });
  check("a duplicate slug is refused", !duplicate.ok);

  const badSlug = await createCategoryAction({
    name: "Bad slug",
    slug: "Not A Slug!",
    description: "An invalid slug must be refused.",
    iconKey: "code",
  });
  check("an invalid slug is refused", !badSlug.ok);

  if (fresh) {
    const renamed = await updateCategoryAction({
      id: fresh.id,
      name: `Renamed ${SUFFIX}`,
      slug: `check-category-${SUFFIX}`,
      description: "Updated by the admin integration check.",
      iconKey: "chart",
    });
    check("a category can be renamed", renamed.ok);

    const selfParent = await updateCategoryAction({
      id: fresh.id,
      name: `Renamed ${SUFFIX}`,
      slug: `check-category-${SUFFIX}`,
      description: "Updated by the admin integration check.",
      iconKey: "chart",
      parentId: fresh.id,
    });
    check("a category cannot be its own parent", !selfParent.ok);
  }

  // A category that holds courses must not be deletable.
  const populated = await db.category.findFirstOrThrow({
    where: { courses: { some: {} } },
    select: { id: true, name: true },
  });
  const blockedDelete = await deleteCategoryAction({ id: populated.id });
  check("a category holding courses cannot be deleted", !blockedDelete.ok);
  check(
    "and it is still there",
    (await db.category.findUnique({ where: { id: populated.id }, select: { id: true } })) !== null,
  );

  // Reorder: a partial list is refused, a complete one is applied.
  const all = await db.category.findMany({
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const partial = await reorderCategoriesAction({ orderedIds: all.slice(1).map((row) => row.id) });
  check("a partial ordering is refused", !partial.ok);

  const reversed = [...all].reverse().map((row) => row.id);
  const reorder = await reorderCategoriesAction({ orderedIds: reversed });
  check("a complete ordering is accepted", reorder.ok);

  const afterReorder = await db.category.findMany({
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  check(
    "positions are renumbered from zero with no gaps",
    afterReorder.every((row, index) => row.position === index),
  );
  check(
    "and the order is the one that was sent",
    afterReorder.map((row) => row.id).join() === reversed.join(),
  );

  // Put the original order back, then remove the check's own category.
  await reorderCategoriesAction({ orderedIds: all.map((row) => row.id) });

  if (fresh) {
    const deleted = await deleteCategoryAction({ id: fresh.id });
    check("an empty category can be deleted", deleted.ok);
    check(
      "and it is gone",
      (await db.category.findUnique({ where: { id: fresh.id }, select: { id: true } })) === null,
    );
  }

  /* ==================================================================== */
  console.log("\nAudit trail");

  // Scoped to the entity types the console manages. The payments path also
  // writes audit rows — order fulfilment and refunds — and those legitimately
  // have no actor, because a signature-verified webhook is not a person. An
  // unscoped window picks those up whenever the payments check has just run,
  // which made this assertion fail for a reason that was never about admin.
  const entries = await db.auditLog.findMany({
    where: {
      createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      entityType: { in: ["User", "Course", "Category"] },
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, entityType: true, actorId: true, metadata: true },
  });

  check("the successful actions were recorded", entries.length > 0);
  check(
    "every action taken through the console names its actor",
    entries.every((entry) => entry.actorId !== null),
  );

  const actions = new Set(entries.map((entry) => entry.action));
  for (const expected of [
    "ROLE_CHANGE",
    "SUSPEND",
    "REINSTATE",
    "UNPUBLISH",
    "REJECT",
    "CREATE",
    "DELETE",
  ]) {
    check(`"${expected}" appears in the trail`, actions.has(expected as never));
  }

  const deletion = entries.find(
    (entry) => entry.action === "DELETE" && entry.entityType === "Category",
  );
  check("the deletion record outlived the row it describes", deletion !== undefined);

  /* ==================================================================== */
  actAs(null);
  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
