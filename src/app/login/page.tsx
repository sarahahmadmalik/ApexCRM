"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormError } from "@/components/auth/form-error";
import { PasswordInput } from "@/components/auth/password-input";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, { error: "", email: "" });
  const invalid = state.error ? true : undefined;
  const describedBy = state.error ? "login-error" : undefined;

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Sign in to the Dua Dev internal tool. Access is limited to leadership.
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
            placeholder="you@dua-dev.com"
            defaultValue={state.email}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className="h-11 text-base sm:text-sm"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="rounded text-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            required
            maxLength={256}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>

        <FormError id="login-error" message={state.error} />

        <Button type="submit" className="h-11 w-full" loading={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
