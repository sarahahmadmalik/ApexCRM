"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormError } from "@/components/auth/form-error";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, { error: "", email: "" });

  return (
    <AuthShell>
      <div className="mb-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <Mail className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot your password?</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Enter your account email and we&apos;ll send you a one-time code to reset it.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            maxLength={254}
            autoComplete="username"
            placeholder="you@apexcrm.io"
            defaultValue={state.email}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "forgot-error" : undefined}
            className="h-11 text-base sm:text-sm"
          />
        </div>

        <FormError id="forgot-error" message={state.error} />

        <Button type="submit" className="h-11 w-full" loading={pending}>
          {pending ? "Sending code..." : "Send code"}
        </Button>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 rounded text-sm font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
