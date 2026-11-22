"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorScene, errorActionClass } from "@/components/ui/error-scene";

/** Catches page-level failures inside the authenticated app shell so the sidebar and topbar stay intact. */
export default function AppErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AppErrorPage caught:", error);
  }, [error]);

  return (
    <ErrorScene
      code="500"
      title="Something went wrong"
      message={
        error.message && !/NEXT_|digest/i.test(error.message)
          ? error.message
          : "We hit an unexpected problem loading this page. Try again, and if it keeps happening let your admin know."
      }
    >
      <button type="button" onClick={reset} className={errorActionClass}>
        Try again
      </button>
      <Link
        href="/overview"
        className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-white/25 dark:text-gray-200 dark:hover:bg-white/10"
      >
        Go to Overview
      </Link>
      {error.digest && <p className="w-full text-xs text-gray-400 dark:text-gray-500">Reference: {error.digest}</p>}
    </ErrorScene>
  );
}
