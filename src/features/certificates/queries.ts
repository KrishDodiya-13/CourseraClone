import "server-only";

import { cache } from "react";

import { db } from "@/server/db";

/**
 * Certificate reads.
 *
 * A certificate is a credential meant to be shown, so both the presentation
 * page and the verification page are public — the *serial* is the capability.
 * That is only safe because serials carry 100 bits of entropy: nobody can
 * enumerate them, and holding one means someone gave it to you.
 *
 * What is deliberately not exposed: the holder's email, their user id, or any
 * other course they have taken. A certificate proves one fact about one
 * course, and the page proves exactly that and nothing more.
 */

export interface PublicCertificate {
  serial: string;
  recipientName: string;
  courseTitle: string;
  instructorName: string;
  issuedAt: string;
  revokedAt: string | null;
  /** Live course slug, so the page can link to it when it still exists. */
  courseSlug: string | null;
  /** Present only for the person the certificate belongs to. */
  isOwner: boolean;
}

export const getCertificateBySerial = cache(
  async (serial: string, viewerId?: string): Promise<PublicCertificate | null> => {
    // Serials are stored uppercase; accept whatever casing was typed in.
    const normalised = serial.trim().toUpperCase();

    const row = await db.certificate.findUnique({
      where: { serial: normalised },
      select: {
        serial: true,
        recipientNameSnapshot: true,
        courseTitleSnapshot: true,
        instructorNameSnapshot: true,
        issuedAt: true,
        revokedAt: true,
        userId: true,
        course: { select: { slug: true, status: true, deletedAt: true } },
      },
    });

    if (!row) return null;

    return {
      serial: row.serial,
      // Snapshots throughout: the page shows what was true at issue.
      recipientName: row.recipientNameSnapshot,
      courseTitle: row.courseTitleSnapshot,
      instructorName: row.instructorNameSnapshot || "Coursera",
      issuedAt: row.issuedAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      courseSlug:
        row.course.deletedAt === null && row.course.status === "PUBLISHED" ? row.course.slug : null,
      isOwner: viewerId !== undefined && viewerId === row.userId,
    };
  },
);
