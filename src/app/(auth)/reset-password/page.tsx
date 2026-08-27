import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/lib/routes";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/form-parts";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell
      title="Set a new password"
      description="Choose something you have not used here before."
      footer={
        <Link href={routes.login} className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <FormMessage message="This link is missing its reset token. Request a new one." />
          <Button fullWidth asChild>
            <Link href={routes.forgotPassword}>Request a new link</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
