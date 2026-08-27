import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { LogoMark } from "@/components/layout/logo";
import { VerifyForm } from "@/app/verify/verify-form";

export const metadata: Metadata = {
  title: "Verify a certificate",
  description:
    "Confirm that a Coursera certificate is genuine. Enter the certificate ID — no account needed.",
};

/** Public entry point for certificate verification. */
export default function VerifyHomePage() {
  return (
    <Section spacing="lg">
      <Container size="sm">
        <Stack gap={6}>
          <PageHeader
            eyebrow={
              <span className="inline-flex items-center gap-1.5">
                <LogoMark className="size-3.5 text-primary" />
                Coursera verification
              </span>
            }
            title="Verify a certificate"
            description="Enter a certificate ID to confirm it was issued by Coursera and has not been withdrawn."
          />

          <Card className="flex flex-col gap-4 p-6">
            <VerifyForm />
            <p className="text-sm text-muted-foreground">
              The ID appears on the certificate itself, in the form
              <code className="mx-1 font-mono">CRS-XXXXX-XXXXX-XXXXX-XXXXX</code>. Case does not
              matter, and IDs never contain the letters I, L, O or U.
            </p>
          </Card>

          <Card variant="muted" className="flex items-start gap-3 p-5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Verification shows the holder&rsquo;s name, the course, the instructor and the
              completion date — nothing else about the person. Certificates are issued only when
              every required lesson of a course has been completed.
            </p>
          </Card>
        </Stack>
      </Container>
    </Section>
  );
}
