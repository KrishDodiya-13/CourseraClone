import type { Metadata } from "next";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { Award, CheckCircle2, Clock, Download, ShieldCheck } from "lucide-react";

import { routes } from "@/lib/routes";
import { requireAuth } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Grid, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { StatTile, SectionHeading } from "@/components/dashboard/stat-tile";
import { CourseThumbnail } from "@/components/catalog/course-thumbnail";
import { getCertificates, getLearningStats } from "@/features/dashboard/queries";

export const metadata: Metadata = { title: "Certificates" };

export default async function DashboardCertificatesPage() {
  const user = await requireAuth(routes.dashboardCertificates);
  const [certificates, stats] = await Promise.all([
    getCertificates(user.id),
    getLearningStats(user.id),
  ]);

  const revokedCount = certificates.filter((c) => c.revokedAt !== null).length;
  const verifiedCount = certificates.length - revokedCount;

  return (
    <Stack gap={6}>
      <SectionHeading title="Certificates">
        <p className="text-sm text-muted-foreground">
          Issued when you finish every required lesson in a course.
        </p>
      </SectionHeading>

      {certificates.length === 0 ? (
        <EmptyState
          icon={<Award aria-hidden="true" />}
          title="No certificates yet"
          description="Complete a course and its certificate appears here, with a code anyone can verify."
          size="lg"
          actions={
            <Button asChild>
              <Link href={routes.dashboardCourses}>See my courses</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* --- summary strip, mirroring the reference's stat row -------- */}
          <Grid cols={4} gap={4}>
            <StatTile
              label="Total certificates"
              value={certificates.length}
              icon={Award}
              tone="primary"
            />
            <StatTile
              label="Learning hours"
              value={Math.round(stats.minutesLearned / 60)}
              icon={Clock}
              tone="accent"
            />
            <StatTile label="Verified" value={verifiedCount} icon={ShieldCheck} tone="success" />
            <StatTile
              label="Courses completed"
              value={stats.completedCount}
              icon={CheckCircle2}
              tone="neutral"
            />
          </Grid>

          {/* --- one horizontal card per certificate, image + details ----- */}
          <Stack gap={5}>
            {certificates.map((certificate) => (
              <Card
                key={certificate.id}
                variant="elevated"
                className="flex flex-col overflow-hidden sm:flex-row"
              >
                <CourseThumbnail
                  title={certificate.courseTitle}
                  src={certificate.courseThumbnailUrl}
                  className="aspect-video w-full sm:aspect-auto sm:w-64 sm:shrink-0"
                />

                <div className="flex flex-1 flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-xl font-semibold">{certificate.courseTitle}</h3>
                      {certificate.providerName ? (
                        <p className="text-muted-foreground">{certificate.providerName}</p>
                      ) : null}
                    </div>

                    {certificate.revokedAt ? (
                      <Badge variant="danger" size="sm">
                        Revoked
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm">
                        <ShieldCheck aria-hidden="true" />
                        Verified
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Issue date</p>
                      <p className="font-medium">{formatDate(certificate.issuedAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Awarded to</p>
                      <p className="font-medium">{certificate.recipientName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Certificate ID</p>
                      <code className="font-mono text-sm font-medium break-all">
                        {certificate.serial}
                      </code>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button size="sm" asChild>
                      <Link href={routes.certificate(certificate.serial)}>
                        <Download className="size-4" aria-hidden="true" />
                        View / download
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={routes.verify(certificate.serial)}>Verify</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}
