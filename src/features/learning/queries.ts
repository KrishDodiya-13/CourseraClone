import "server-only";

import { cache } from "react";

import { db } from "@/server/db";
import { sanitizeLessonHtml } from "@/lib/sanitize-html";
import type { LearnerCourse, LearnerLesson, LearnerSection } from "@/features/learning/types";
import { getAssignmentForLesson, getQuizForLesson } from "@/features/assessment/queries";

/**
 * Everything the learning surface needs, in one read.
 *
 * Lock state is computed here rather than in the browser. That is deliberate:
 * a locked lesson must not have its content shipped to the client at all, so
 * the decision has to happen before the payload is built.
 */
export const getLearningCourse = cache(
  async (
    courseSlug: string,
    userId: string,
    activeLessonId?: string,
  ): Promise<LearnerCourse | null> => {
    const course = await db.course.findFirst({
      where: { slug: courseSlug, deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        sequentialProgress: true,
        sections: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            lessons: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                title: true,
                summary: true,
                type: true,
                durationSeconds: true,
                isFreePreview: true,
                isRequired: true,
                articleContent: true,
                resources: {
                  orderBy: { position: "asc" },
                  select: {
                    id: true,
                    title: true,
                    kind: true,
                    fileKey: true,
                    externalUrl: true,
                    mimeType: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) return null;

    const [progressRows, enrollment, certificate] = await Promise.all([
      db.lessonProgress.findMany({
        where: { userId, lesson: { courseId: course.id } },
        select: { lessonId: true, completed: true, positionSeconds: true },
      }),
      db.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
        select: {
          id: true,
          status: true,
          progress: { select: { lastLessonId: true, percent: true } },
        },
      }),
      db.certificate.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
        select: { serial: true },
      }),
    ]);

    if (!enrollment) return null;

    const progressByLesson = new Map(progressRows.map((row) => [row.lessonId, row]));

    // Walk the course in order so lock state can depend on what came before.
    let previousRequiredComplete = true;
    let index = 0;
    const flatLessons: LearnerLesson[] = [];

    const sections: LearnerSection[] = course.sections.map((section) => {
      const lessons = section.lessons.map((lesson) => {
        const progress = progressByLesson.get(lesson.id);
        const completed = progress?.completed ?? false;

        // Sequential courses gate on the previous *required* lesson only, so
        // skipping an optional bonus lesson never strands the learner.
        const locked = course.sequentialProgress && !previousRequiredComplete && !completed;

        if (lesson.isRequired) previousRequiredComplete = completed;

        const view: LearnerLesson = {
          id: lesson.id,
          title: lesson.title,
          summary: lesson.summary,
          type: lesson.type,
          durationSeconds: lesson.durationSeconds,
          isFreePreview: lesson.isFreePreview,
          isRequired: lesson.isRequired,
          // Body is only sent for the lesson actually being viewed, and never
          // for a locked one.
          // Sanitised here rather than at render: the learn shell and the
          // offline bundle both draw from this shape, and a renderer that has
          // to remember to sanitise is one that eventually forgets.
          articleContent:
            !locked && lesson.id === activeLessonId
              ? sanitizeLessonHtml(lesson.articleContent)
              : null,
          resources: locked ? [] : lesson.resources,
          // Filled in below, for the active lesson only.
          quiz: null,
          assignment: null,
          completed,
          positionSeconds: progress?.positionSeconds ?? 0,
          locked,
          sectionId: section.id,
          sectionTitle: section.title,
          index: index++,
        };

        flatLessons.push(view);
        return view;
      });

      return {
        id: section.id,
        title: section.title,
        description: section.description,
        lessons,
      };
    });

    const requiredLessons = flatLessons.filter((lesson) => lesson.isRequired);
    const completedRequired = requiredLessons.filter((lesson) => lesson.completed).length;
    const percent =
      requiredLessons.length === 0
        ? 0
        : Math.round((completedRequired / requiredLessons.length) * 100);

    // Assessment payloads are loaded only for the lesson actually open, and
    // never for a locked one.
    const active = flatLessons.find((entry) => entry.id === activeLessonId && !entry.locked);
    if (active) {
      if (active.type === "QUIZ") {
        active.quiz = await getQuizForLesson(active.id, userId);
      } else if (active.type === "ASSIGNMENT") {
        active.assignment = await getAssignmentForLesson(active.id, userId);
      }
    }

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      sequentialProgress: course.sequentialProgress,
      sections,
      lessons: flatLessons,
      completedLessons: flatLessons.filter((lesson) => lesson.completed).length,
      requiredLessons: requiredLessons.length,
      totalLessons: flatLessons.length,
      percent,
      lastLessonId: enrollment.progress?.lastLessonId ?? null,
      isComplete: enrollment.status === "COMPLETED",
      enrollmentId: enrollment.id,
      certificateSerial: certificate?.serial ?? null,
    };
  },
);

/**
 * Picks the lesson to open.
 *
 * Order of preference: an explicitly requested lesson, then where the learner
 * left off, then the first incomplete lesson, then the first lesson. A locked
 * lesson is never chosen, however it was requested.
 */
export function resolveActiveLesson(
  course: LearnerCourse,
  requestedId?: string,
): LearnerLesson | null {
  const openable = course.lessons.filter((lesson) => !lesson.locked);
  if (openable.length === 0) return null;

  if (requestedId) {
    const requested = openable.find((lesson) => lesson.id === requestedId);
    if (requested) return requested;
  }

  if (course.lastLessonId) {
    const last = openable.find((lesson) => lesson.id === course.lastLessonId);
    if (last) return last;
  }

  return openable.find((lesson) => !lesson.completed) ?? openable[0] ?? null;
}
