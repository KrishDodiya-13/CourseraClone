import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { routes } from "@/lib/routes";
import { clientEnv } from "@/lib/env";
import { getSessionUser } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container, Section, Stack } from "@/components/layout/primitives";
import { CertificateSheet } from "@/components/certificates/certificate-sheet";
import { CertificateActions } from "@/components/certificates/certificate-actions";
import { getCertificateBySerial } from "@/features/certificates/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}): Promise<Metadata> {
  const { certificateId } = await params;
  const certificate = await getCertificateBySerial(certificateId);

  if (!certificate) return { title: "Certificate not found" };

  return {
    title: `${certificate.courseTitle} — certificate`,
    description: `${certificate.recipientName} completed ${certificate.courseTitle} on Coursera.`,
    // A credential is meant to be shared, but it carries a person's name, so
    // it is not put in front of search engines.
    robots: { index: false, follow: false },
  };
}

/**
 * The certificate page.
 *
 * Public, because a credential exists to be shown — but only to someone
 * holding the serial, which carries 100 bits of entropy and cannot be guessed
 * or enumerated. The page proves one fact about one course and exposes nothing
 * else about the holder: no email, no user id, no other enrolments.
 */
export default async function CertificatePage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;
  const viewer = await getSessionUser();
  const certificate = await getCertificateBySerial(certificateId, viewer?.id);

  if (!certificate) notFound();

  const verifyUrl = `${clientEnv.NEXT_PUBLIC_APP_URL}${routes.verify(certificate.serial)}`;

  return (
    <Section spacing="md">
      <Container>
        <Stack gap={6}>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              {certificate.isOwner ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={routes.certificates}>
                    <ArrowLeft aria-hidden="true" />
                    My certificates
                  </Link>
                </Button>
              ) : null}
              {certificate.revokedAt ? (
                <Badge variant="danger">Revoked</Badge>
              ) : (
                <Badge variant="success">
                  <ShieldCheck aria-hidden="true" />
                  Verified credential
                </Badge>
              )}
            </div>

            <CertificateActions verifyUrl={verifyUrl} />
          </div>

          <CertificateSheet certificate={certificate} />

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground print:hidden">
            <span>
              Anyone can confirm this at{" "}
              <Link
                href={routes.verify(certificate.serial)}
                className="text-primary hover:underline"
              >
                {verifyUrl}
              </Link>
            </span>
            {certificate.courseSlug ? (
              <Button variant="outline" size="sm" asChild className="ml-auto">
                <Link href={routes.course(certificate.courseSlug)}>View the course</Link>
              </Button>
            ) : null}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
