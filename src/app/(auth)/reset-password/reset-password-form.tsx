"use client";

import { useActionState } from "react";
import Link from "next/link";

import { routes } from "@/lib/routes";
import { resetPasswordAction, type ActionResult } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FormMessage, PasswordInput } from "@/components/auth/form-parts";

function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    resetPasswordAction,
    null,
  );

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage message={state.message} tone="success" />
        <Button fullWidth asChild>
          <Link href={routes.login}>Go to log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />

      <FormMessage message={state?.message} />

      <Field error={state?.fieldErrors?.password?.[0]}>
        <FieldLabel>New password</FieldLabel>
        <PasswordInput name="password" autoComplete="new-password" required autoFocus />
        <FieldDescription>At least 10 characters.</FieldDescription>
      </Field>

      <Field error={state?.fieldErrors?.confirmPassword?.[0]}>
        <FieldLabel>Confirm new password</FieldLabel>
        <PasswordInput name="confirmPassword" autoComplete="new-password" required />
      </Field>

      <Button type="submit" fullWidth isLoading={pending} loadingText="Saving">
        Set new password
      </Button>
    </form>
  );
}

export { ResetPasswordForm };
