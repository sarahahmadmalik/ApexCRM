"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { verifyOtp } from "./actions";
import { resendOtp } from "../forgot-password/actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/auth/form-error";

const RESEND_COOLDOWN = 60;

export function VerifyOtpForm({ maskedEmail }: { maskedEmail: string }) {
  const [state, formAction, pending] = useActionState(verifyOtp, { error: "" });
  const [resend, resendAction, resending] = useActionState(resendOtp, { message: "", error: "", n: 0 });
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  // A code was just sent to reach this page, so the resend timer starts now.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  return (
    <>
      <div className="mb-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Enter your code</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          If <span className="font-medium text-gray-700 dark:text-gray-200">{maskedEmail}</span> has an account, we sent a
          verification code to it. It expires in one hour.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <div>
          <Label htmlFor="token">Verification code</Label>
          <Input
            id="token"
            name="token"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            autoFocus
            required
            minLength={6}
            maxLength={10}
            placeholder="000000"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "otp-error" : undefined}
            className="h-14 text-center font-mono-brand text-2xl tracking-[0.4em] placeholder:tracking-[0.4em]"
          />
        </div>

        <FormError id="otp-error" message={state.error} />

        <Button type="submit" className="h-11 w-full" loading={pending}>
          {pending ? "Verifying..." : "Verify code"}
        </Button>
      </form>

      <div className="mt-6 space-y-3 text-center text-sm">
        <form
          action={(formData) => {
            setCooldown(RESEND_COOLDOWN);
            resendAction(formData);
          }}
          className="text-gray-500 dark:text-gray-400">
          Didn&apos;t get it?{" "}
          <button
            type="submit"
            disabled={cooldown > 0 || resending}
            className="cursor-pointer rounded font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? "Sending..." : "Resend code"}
          </button>
        </form>

        <div aria-live="polite">
          {resend.message && <p className="text-emerald-600 dark:text-emerald-400">{resend.message}</p>}
          {resend.error && <p className="text-red-600 dark:text-red-400">{resend.error}</p>}
        </div>

        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-1.5 rounded font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Use a different email
        </Link>
      </div>
    </>
  );
}
