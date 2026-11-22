"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { Sparkles, KeyRound } from "lucide-react";
import { login } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormError } from "@/components/auth/form-error";
import { PasswordInput } from "@/components/auth/password-input";

const SAMPLE_ACCOUNTS = [
  {
    label: "Boss / Executive",
    role: "VP of Operations (Full CRM, HR & Approvals)",
    email: "demo@apexcrm.io",
    password: "ApexDemo2026!",
  },
  {
    label: "Project Manager",
    role: "Delivery Lead (Projects, Hiring & CRM)",
    email: "team@apexcrm.io",
    password: "ApexTeam2026!",
  },
  {
    label: "Employee Portal",
    role: "Engineer (Work Timer, Leave & Salary Only)",
    email: "employee@apexcrm.io",
    password: "ApexStaff2026!",
  },
] as const;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, { error: "", email: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const invalid = state.error ? true : undefined;
  const describedBy = state.error ? "login-error" : undefined;

  function fillSampleCredentials(email: string, password: string) {
    const form = formRef.current;
    if (!form) return;
    const emailInput = form.querySelector<HTMLInputElement>('input[name="email"]');
    const passwordInput = form.querySelector<HTMLInputElement>('input[name="password"]');
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = password;
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to ApexCRM</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Sign in to explore the interactive CRM, Talent Acquisition, Project Delivery, and Finance suite.
        </p>
      </div>

      {/* Interactive Website Showcase Quick-Login */}
      <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/60 p-3.5 dark:border-brand-500/25 dark:bg-brand-500/10">
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-brand-700 uppercase dark:text-brand-300">
          <Sparkles className="h-3.5 w-3.5" />
          Interactive Demo Accounts
        </div>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          Click a sample account below to autofill credentials for the live showcase:
        </p>
        <div className="mt-2.5 grid grid-cols-1 gap-2">
          {SAMPLE_ACCOUNTS.map((acct) => (
            <button
              key={acct.email}
              type="button"
              onClick={() => fillSampleCredentials(acct.email, acct.password)}
              className="group flex cursor-pointer flex-col items-start rounded-lg border border-brand-200/80 bg-white px-3 py-2 text-left transition-all hover:border-brand-500 hover:shadow-xs dark:border-white/10 dark:bg-navy-800 dark:hover:border-brand-400"
            >
              <span className="flex w-full items-center justify-between text-xs font-semibold text-gray-900 dark:text-white">
                {acct.label}
                <KeyRound className="h-3 w-3 text-brand-500 opacity-70 group-hover:opacity-100" />
              </span>
              <span className="font-mono-brand mt-0.5 text-[11px] text-brand-600 dark:text-brand-300">
                {acct.email}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{acct.role}</span>
            </button>
          ))}
        </div>
      </div>

      <form ref={formRef} action={formAction} className="space-y-5">
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
            placeholder="demo@apexcrm.io"
            defaultValue={state.email || "demo@apexcrm.io"}
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
            defaultValue="ApexDemo2026!"
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>

        <FormError id="login-error" message={state.error} />

        <Button type="submit" className="h-11 w-full" loading={pending}>
          {pending ? "Signing in..." : "Sign in to ApexCRM"}
        </Button>
      </form>
    </AuthShell>
  );
}
