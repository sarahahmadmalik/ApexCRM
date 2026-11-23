"use client";

import Link from "next/link";
import { useActionState, useRef, useTransition } from "react";
import { ChevronDown, Loader2, Users } from "lucide-react";
import { login } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormError } from "@/components/auth/form-error";
import { PasswordInput } from "@/components/auth/password-input";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const DEMO_USERS = [
  {
    name: "Alex Vance",
    badge: "Boss / Admin",
    lightBadgeClass: "bg-brand-50 text-brand-700 ring-brand-600/20",
    darkBadgeClass: "bg-brand-500/15 text-brand-300 ring-brand-400/30",
    email: "demo@apexcrm.io",
    password: "ApexDemo2026!",
  },
  {
    name: "Maya Lin",
    badge: "Manager",
    lightBadgeClass: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    darkBadgeClass: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
    email: "team@apexcrm.io",
    password: "ApexTeam2026!",
  },
  {
    name: "Lukas Weber",
    badge: "Employee",
    lightBadgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    darkBadgeClass: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
    email: "employee@apexcrm.io",
    password: "ApexStaff2026!",
  },
] as const;

export default function LoginPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [state, formAction, pending] = useActionState(login, { error: "", email: "" });
  const [demoPending, startDemoTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const invalid = state.error ? true : undefined;
  const describedBy = state.error ? "login-error" : undefined;

  function autoLoginDemo(email: string, password: string) {
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", password);
    startDemoTransition(() => {
      formAction(fd);
    });
  }

  const isSigningIn = pending || demoPending;

  const demoMenu = (
    <DropdownMenu
      align="right"
      panelClassName="w-64 p-1.5"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={isSigningIn}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-navy-800 dark:text-gray-200 dark:hover:bg-white/10"
        >
          {demoPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" /> : <Users className="h-3.5 w-3.5 text-brand-500" />}
          <span>Demo</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform duration-150", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-0.5">
          {DEMO_USERS.map((u) => (
            <button
              key={u.email}
              type="button"
              onClick={() => {
                close();
                autoLoginDemo(u.email, u.password);
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{u.name}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ring-inset",
                  isDark ? u.darkBadgeClass : u.lightBadgeClass
                )}
              >
                {u.badge}
              </span>
            </button>
          ))}
        </div>
      )}
    </DropdownMenu>
  );

  return (
    <AuthShell headerActions={demoMenu}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Sign in to your Apex CRM workspace, or pick a role from Demo above.
        </p>
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
            placeholder="you@apexcrm.io"
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

        <Button type="submit" className="h-11 w-full" loading={isSigningIn}>
          {isSigningIn ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
