"use client";

import { useActionState } from "react";

import { forgotPasswordAction, type ActionResult } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/auth/form-parts";

function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    forgotPasswordAction,
    null,
  );

  // The success response is identical whether or not the account exists, so
  // this form cannot be used to discover who is registered.
  if (state?.ok && state.message) {
    return <FormMessage message={state.message} tone="success" />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
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

      <Button type="submit" fullWidth isLoading={pending} loadingText="Sending link">
        Send reset link
      </Button>
    </form>
  );
}

export { ForgotPasswordForm };
