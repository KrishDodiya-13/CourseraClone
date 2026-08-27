"use client";

import { useActionState } from "react";
import Link from "next/link";

import { routes } from "@/lib/routes";
import { registerAction, type ActionResult } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  FormMessage,
  GoogleButton,
  PasswordInput,
  TimezoneField,
} from "@/components/auth/form-parts";

function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    registerAction,
    null,
  );

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton
        enabled={googleEnabled}
        callbackUrl={routes.dashboard}
        label="Sign up with Google"
      />

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <TimezoneField />

        <FormMessage
          message={state?.ok === false ? state.message : undefined}
          tone={state?.ok ? "success" : "error"}
        />

        <Field error={state?.fieldErrors?.name?.[0]}>
          <FieldLabel>Full name</FieldLabel>
          <Input name="name" autoComplete="name" placeholder="Amara Osei" required />
        </Field>

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
          <FieldLabel>Password</FieldLabel>
          <PasswordInput name="password" autoComplete="new-password" required />
          <FieldDescription>
            At least 10 characters. A memorable phrase beats a short, cryptic one.
          </FieldDescription>
        </Field>

        <Field error={state?.fieldErrors?.confirmPassword?.[0]}>
          <FieldLabel>Confirm password</FieldLabel>
          <PasswordInput name="confirmPassword" autoComplete="new-password" required />
        </Field>

        <Field error={state?.fieldErrors?.acceptTerms?.[0]}>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="acceptTerms"
              required
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
            />
            <span className="text-muted-foreground">
              I agree to the{" "}
              <Link href={routes.terms} className="text-primary hover:underline">
                terms
              </Link>{" "}
              and{" "}
              <Link href={routes.privacy} className="text-primary hover:underline">
                privacy policy
              </Link>
              .
            </span>
          </label>
        </Field>

        <Button type="submit" fullWidth isLoading={pending} loadingText="Creating account">
          Create account
        </Button>
      </form>
    </div>
  );
}

export { RegisterForm };
