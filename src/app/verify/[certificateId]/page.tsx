import type { Metadata } from "next";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { CircleX, Search, ShieldCheck } from "lucide-react";

import { routes } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { LogoMark } from "@/components/layout/logo";
import { VerificationVerdict } from "@/components/certificates/certificate-sheet";
import { getCertificateBySerial } from "@/features/certificates/queries";
import { VerifyForm } from "@/app/verify/verify-form";

export const metadata: Metadata = {
  title: "Verify a certificate",
  description: "Confirm that a Coursera certificate is genuine.",
};

/**
 * Public certificate verification.
 *
 * Deliberately usable with no account: the point of a credential is that a
 * third party — an employer, a client — can check it. So this page takes a
 * serial and answers one question honestly.
 *
 * It returns a definite "no such certificate" rather than a 404 page. Someone
 * checking a credential needs to be told it does not exist; a generic
 * not-found leaves them wondering whether they mistyped or the site is broken.
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;
  const certificate = await getCertificateBySerial(certificateId);

  return (
    <Section spacing="md">
      <Container size="sm">
        <Stack gap={6}>
          <PageHeader
            eyebrow={
              <span className="inline-flex items-center gap-1.5">
                <LogoMark className="size-3.5 text-primary" />
                Coursera verification
              </span>
            }
            title="Certificate check"
            description="Anyone can confirm a Coursera certificate with its ID. No account needed."
          />

          {certificate === null ? (
            <>
              <Card className="flex items-start gap-3 border-danger/40 p-4">
                <CircleX className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-danger">No certificate with that ID</p>
                  <p className="text-sm text-muted-foreground">
                    Coursera has never issued a certificate with this ID. Check for a typo — IDs
                    contain no letter I, L, O or U.
                  </p>
                </div>
              </Card>

              <Card className="flex flex-col gap-3 p-5">
                <p className="text-sm font-medium">Try another ID</p>
                <VerifyForm defaultValue={certificateId} />
              </Card>
            </>
          ) : (
            <>
              <VerificationVerdict certificate={certificate} />

              <Card className="flex flex-col gap-4 p-6">
                <Field label="Awarded to" value={certificate.recipientName} emphasis />
                <Separator />
                <Field label="Course" value={certificate.courseTitle} emphasis />
                <Separator />
                <Field label="Instructor" value={certificate.instructorName} />
                <Separator />
                <Field label="Completed" value={formatDate(certificate.issuedAt)} />
                <Separator />
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
                    Certificate ID
                  </span>
                  <code className="font-mono text-sm break-all">{certificate.serial}</code>
                </div>

                {certificate.revokedAt ? (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
                        Revoked
                      </span>
                      <span className="text-sm text-danger">
                        {new Date(certificate.revokedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                ) : null}
              </Card>

              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="neutral" size="sm">
                  <ShieldCheck aria-hidden="true" />
                  Issued by Coursera
                </Badge>
                <Button variant="outline" size="sm" asChild className="ml-auto">
                  <Link href={routes.certificate(certificate.serial)}>View the certificate</Link>
                </Button>
              </div>
            </>
          )}

          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="size-3.5 shrink-0" aria-hidden="true" />
            Checking a different certificate?{" "}
            <Link href={routes.verifyHome} className="text-primary hover:underline">
              Start again
            </Link>
          </p>
        </Stack>
      </Container>
    </Section>
  );
}

function Field({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className={emphasis ? "text-base font-semibold" : "text-sm"}>{value}</span>
    </div>
  );
}
