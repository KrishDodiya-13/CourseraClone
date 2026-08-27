import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { routes } from "@/lib/routes";
import { googleAuthEnabled } from "@/server/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoadingState } from "@/components/states/loading-state";
import { LoginForm } from "@/app/(auth)/login/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Log in to pick up where you left off."
      footer={
        <>
          New here?{" "}
          <Link href={routes.register} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {/* useSearchParams needs a Suspense boundary to keep the page static. */}
      <Suspense fallback={<LoadingState size="sm" label="Loading form" />}>
        <LoginForm googleEnabled={googleAuthEnabled} />
      </Suspense>
    </AuthShell>
  );
}
