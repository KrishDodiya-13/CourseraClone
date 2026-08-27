import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";

import { cn } from "@/lib/utils";
import { clientEnv } from "@/lib/env";
import { LogoMark } from "@/components/layout/logo";
import type { PublicCertificate } from "@/features/certificates/queries";

/**
 * The certificate itself.
 *
 * Designed to survive being printed: fixed A4-landscape proportions, a border
 * that reproduces on paper, and no reliance on background colour to carry
 * meaning — browsers drop backgrounds by default when printing, so anything
 * important is drawn with borders and text rather than fills.
 *
 * Carries `id="certificate-sheet"` so the print stylesheet can isolate it.
 */
function CertificateSheet({
  certificate,
  className,
}: {
  certificate: PublicCertificate;
  className?: string;
}) {
  const issued = formatDate(certificate.issuedAt);

  const verifyUrl = `${clientEnv.NEXT_PUBLIC_APP_URL}/verify/${certificate.serial}`;

  return (
    <div
      id="certificate-sheet"
      className={cn(
        "relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border-2 border-primary/30 bg-card",
        "aspect-auto p-8 sm:aspect-[297/210] sm:p-12",
        certificate.revokedAt && "opacity-60",
        className,
      )}
    >
      {/* Corner rules — printed as borders, not fills. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-4 rounded-lg border border-primary/20"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-primary print:hidden"
      />

      <div className="relative flex h-full flex-col justify-between gap-8">
        {/* --- masthead ------------------------------------------------- */}
        <div className="flex items-start justify-between gap-4">
          <span className="inline-flex items-center gap-2">
            <LogoMark className="size-7 text-primary" />
            <span className="font-display text-xl font-semibold tracking-tight">Coursera</span>
          </span>

          <span className="text-right">
            <span className="block font-mono text-2xs tracking-wide text-muted-foreground uppercase">
              Certificate of completion
            </span>
            <span className="block font-mono text-2xs text-muted-foreground">{issued}</span>
          </span>
        </div>

        {/* --- body ------------------------------------------------------ */}
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
            This certifies that
          </p>

          <p className="font-display text-3xl leading-tight font-semibold text-balance sm:text-4xl">
            {certificate.recipientName}
          </p>

          <p className="max-w-xl text-sm text-muted-foreground">
            has successfully completed every required lesson of
          </p>

          <p className="font-display text-xl leading-snug font-semibold text-balance sm:text-2xl">
            {certificate.courseTitle}
          </p>

          <p className="text-sm text-muted-foreground">
            taught by{" "}
            <span className="font-medium text-foreground">{certificate.instructorName}</span>
          </p>

          {/* A seal, drawn rather than imported.
              It is what separates a certificate from a receipt: the eye reads
              a medallion as an act of attestation. Pure SVG so it stays crisp
              at any size and survives the print stylesheet, where background
              images are dropped by default. */}
          <svg
            viewBox="0 0 120 120"
            aria-hidden="true"
            className="mt-2 size-24 text-primary sm:size-28"
          >
            <defs>
              <path id="seal-arc" d="M60,60 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0" />
            </defs>

            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.55"
            />
            <circle
              cx="60"
              cy="60"
              r="47"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              opacity="0.4"
            />

            {/* Ticks around the rim — the texture that reads as "minted". */}
            {Array.from({ length: 48 }, (_, index) => {
              const angle = (index / 48) * Math.PI * 2;
              const inner = 40;
              const outer = index % 4 === 0 ? 45 : 43;
              return (
                <line
                  key={index}
                  x1={60 + Math.cos(angle) * inner}
                  y1={60 + Math.sin(angle) * inner}
                  x2={60 + Math.cos(angle) * outer}
                  y2={60 + Math.sin(angle) * outer}
                  stroke="currentColor"
                  strokeWidth={index % 4 === 0 ? 1.4 : 0.7}
                  opacity="0.5"
                />
              );
            })}

            <text
              className="fill-current text-[9px] font-semibold tracking-[0.32em] uppercase"
              opacity="0.75"
            >
              <textPath href="#seal-arc" startOffset="25%" textAnchor="middle">
                Coursera · Verified
              </textPath>
            </text>

            <circle cx="60" cy="60" r="26" fill="currentColor" opacity="0.08" />
            <path
              d="M48 60.5 L56 68.5 L73 51"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* --- footer ---------------------------------------------------- */}
        <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
              Certificate ID
            </span>
            <code className="font-mono text-sm font-semibold break-all">{certificate.serial}</code>
          </div>

          <div className="flex flex-col gap-0.5 sm:text-right">
            <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
              Verify at
            </span>
            <span className="font-mono text-2xs break-all text-muted-foreground">{verifyUrl}</span>
          </div>
        </div>
      </div>

      {certificate.revokedAt ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-12deg] rounded-lg border-4 border-danger px-6 py-2 font-display text-2xl font-bold tracking-widest text-danger uppercase">
            Revoked
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Compact "this is genuine" panel, used on the verification page. */
function VerificationVerdict({ certificate }: { certificate: PublicCertificate }) {
  const revoked = certificate.revokedAt !== null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        revoked ? "border-danger/40 bg-danger-subtle" : "border-success/40 bg-success-subtle",
      )}
      role="status"
    >
      <ShieldCheck
        className={cn("mt-0.5 size-5 shrink-0", revoked ? "text-danger" : "text-success")}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5">
        <p className={cn("text-sm font-semibold", revoked ? "text-danger" : "text-success")}>
          {revoked ? "This certificate has been revoked" : "This certificate is genuine"}
        </p>
        <p className="text-sm text-muted-foreground">
          {revoked
            ? "It was issued by Coursera but has since been withdrawn, and should not be relied on."
            : "It was issued by Coursera and has not been withdrawn."}
        </p>
      </div>
    </div>
  );
}

export { CertificateSheet, VerificationVerdict };
