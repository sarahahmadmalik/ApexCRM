"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { setNewPassword } from "./actions";
import { Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/auth/form-error";
import { PasswordInput } from "@/components/auth/password-input";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(setNewPassword, { error: "" });
  const describedBy = state.error ? "reset-error" : undefined;

  return (
    <>
      <div className="mb-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set a new password</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Code verified. Choose a new password of at least 10 characters with letters and numbers. You&apos;ll be signed out of your other devices.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <div>
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={10}
            maxLength={72}
            autoFocus
            autoComplete="new-password"
            aria-describedby={describedBy}
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm new password</Label>
          <PasswordInput
            id="confirm"
            name="confirm"
            required
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
            aria-describedby={describedBy}
          />
        </div>

        <FormError id="reset-error" message={state.error} />

        <Button type="submit" className="h-11 w-full" loading={pending}>
          {pending ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </>
  );
}
