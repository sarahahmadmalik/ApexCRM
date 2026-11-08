import Link from "next/link";
import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export const metadata: Metadata = { title: "Page not found · Dua Dev Internal Tool" };

/**
 * The 404 page — for unknown URLs and for pages a user isn't allowed to know exist (User Management
 * for non-admins). Uses the theme tokens, so it follows light/dark like every other page, and works
 * both inside the app shell and on its own.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center px-6 py-16">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="relative mb-6">
          <span
            aria-hidden
            className="font-display bg-gradient-to-b from-brand-500 to-brand-700 bg-clip-text text-[7rem] leading-none font-extrabold tracking-tight text-transparent sm:text-[9rem] dark:from-brand-300 dark:to-brand-600"
          >
            404
          </span>
          <span className="absolute -top-1 -right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-sm ring-1 ring-brand-600/10 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-400/20">
            <Compass className="h-5 w-5" />
          </span>
        </div>

        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          The page you&apos;re looking for doesn&apos;t exist, was moved, or isn&apos;t available to your account.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <BackButton />
          <Link
            href="/overview"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-brand-600 hover:shadow-[0_0_0_3px_rgba(6,182,212,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.97]"
          >
            Go to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
