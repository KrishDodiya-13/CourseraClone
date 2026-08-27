import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/lib/routes";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we will send you a link to set a new one."
      footer={
        <Link href={routes.login} className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
