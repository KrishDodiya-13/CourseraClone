"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { routes } from "@/lib/routes";
import { loginAction, type ActionResult } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormMessage, GoogleButton, PasswordInput } from "@/components/auth/form-parts";

function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? routes.dashboard;

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    loginAction,
    null,
  );

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton enabled={googleEnabled} callbackUrl={callbackUrl} />

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <FormMessage message={state?.ok === false ? state.message : undefined} />

        <Field error={state?.fieldErrors?.email?.[0]}>
          <FieldLabel>Email</FieldLabel>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </Field>

        <Field error={state?.fieldErrors?.password?.[0]}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel>Password</FieldLabel>
            <Link href={routes.forgotPassword} className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput name="password" autoComplete="current-password" required />
        </Field>

        <Button type="submit" fullWidth isLoading={pending} loadingText="Signing in">
          Log in
        </Button>
      </form>
    </div>
  );
}

export { LoginForm };
