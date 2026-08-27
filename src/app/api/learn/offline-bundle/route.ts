import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { getSessionUser } from "@/server/authz";
import { sanitizeLessonHtml } from "@/lib/sanitize-html";
import type { OfflineBundle, OfflineSection } from "@/offline/db";

/**
 * Builds the downloadable bundle for one course.
 *
 * Two rules govern what goes in it.
 *
 * **Authorisation.** Enrolment is re-read here on every request. A download is
 * a bulk export of paid material, so it gets the same check as the player, not
 * a weaker one — and the check happens before any content is assembled.
 *
 * **No video, ever.** Video is excluded by construction: the select below does
 * not read `videoPlaybackId` or `videoAssetId`, so there is no path by which a
 * playback identifier reaches the client's disk. Video lessons still appear in
 * the bundle as curriculum entries — a learner needs to see the shape of the
 * course offline — but carry `videoAvailableOffline: false` and no source.
 *
 * Nothing authentication-related is included. The bundle is content only.
 */

const querySchema = z.object({ courseSlug: z.string().min(1).max(200) });

/** Pulls `src` values out of authored article HTML so they can be pre-cached. */
function extractImageUrls(html: string | null): string[] {
  if (!html) return [];
  const urls = new Set<string>();
  const pattern = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1];
    // Data URIs are already inline; remote hosts are out of our control and
    // may not send permissive CORS headers.
    if (url && !url.startsWith("data:")) urls.add(url);
  }
  return [...urls];
}

/** The lesson body as it will actually be rendered, or null for non-articles. */
function safeArticle(lesson: { type: string; articleContent: string | null }): string | null {
  return lesson.type === "ARTICLE" ? sanitizeLessonHtml(lesson.articleContent) : null;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to download courses." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ courseSlug: searchParams.get("courseSlug") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const course = await db.course.findFirst({
    where: { slug: parsed.data.courseSlug, status: "PUBLISHED", deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      sequentialProgress: true,
      sections: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          lessons: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              summary: true,
              type: true,
              durationSeconds: true,
              isRequired: true,
              position: true,
              articleContent: true,
              // videoPlaybackId / videoAssetId are deliberately NOT selected.
              resources: {
                orderBy: { position: "asc" },
                select: { id: true, title: true, kind: true, externalUrl: true },
              },
            },
          },
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  // The authorisation gate. Same rule as the player: a REFUNDED or CANCELLED
  // enrolment row exists but grants nothing, and an expired one is no
  // enrolment.
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { status: true, expiresAt: true },
  });

  const authorised =
    enrollment &&
    (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED") &&
    (enrollment.expiresAt === null || enrollment.expiresAt > new Date());

  if (!authorised) {
    return NextResponse.json({ error: "You are not enrolled in this course." }, { status: 403 });
  }

  const progressRows = await db.lessonProgress.findMany({
    where: { userId: user.id, lesson: { courseId: course.id } },
    select: { lessonId: true, completed: true, positionSeconds: true },
  });

  const sections: OfflineSection[] = course.sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    position: section.position,
    lessons: section.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      type: lesson.type,
      durationSeconds: lesson.durationSeconds,
      isRequired: lesson.isRequired,
      position: lesson.position,
      // Only article bodies travel. A PDF's file key is a storage pointer,
      // not content, and would be useless offline anyway.
      // Sanitised before it leaves the server, so the offline reader — which
      // renders it with no network and no second chance to check — can never
      // receive markup the online reader would have refused.
      articleContent: safeArticle(lesson),
      videoAvailableOffline: false as const,
      resources: lesson.resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        kind: resource.kind,
        externalUrl: resource.externalUrl,
      })),
      // Read from the *sanitised* body, so the list of images the reader
      // caches can never include one the rendered content no longer refers to.
      imageUrls: extractImageUrls(safeArticle(lesson)),
    })),
  }));

  const bundle: OfflineBundle = {
    courseId: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    sequentialProgress: course.sequentialProgress,
    sections,
    progress: progressRows,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(bundle, {
    // A bundle is per-user (it carries their progress) and must never land in
    // a shared or intermediary cache.
    headers: { "Cache-Control": "private, no-store" },
  });
}
