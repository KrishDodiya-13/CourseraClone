"use client";

import * as React from "react";
import { Check, Link2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * Download and share controls.
 *
 * "Download" opens the browser's print dialog, where every modern browser
 * offers "Save as PDF". That is a deliberate choice over adding a PDF library:
 * it needs no dependency, no server rendering step and no font embedding, and
 * it produces a real PDF the learner controls. The trade-off is honest and
 * stated in the button's own helper text — this is print-to-PDF, not a
 * server-generated file.
 */
function CertificateActions({ verifyUrl }: { verifyUrl: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      toast.success("Verification link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link. Select and copy it manually.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button onClick={() => window.print()}>
        <Printer aria-hidden="true" />
        Download PDF
      </Button>

      <Button variant="outline" onClick={() => void copyLink()}>
        {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        {copied ? "Copied" : "Copy verification link"}
      </Button>
    </div>
  );
}

export { CertificateActions };
