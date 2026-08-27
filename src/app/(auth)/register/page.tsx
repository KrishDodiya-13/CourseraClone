import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/lib/routes";
import { googleAuthEnabled } from "@/server/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/app/(auth)/register/register-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Free to join. Start with a free course today."
      footer={
        <>
          Already have an account?{" "}
          <Link href={routes.login} className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <RegisterForm googleEnabled={googleAuthEnabled} />
    </AuthShell>
  );
}
