"use client";

import { useEffect } from "react";

/** Root-level fallback error boundary when the root layout itself fails to render. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GlobalError caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="max-w-md space-y-4">
          <p className="text-5xl font-extrabold text-cyan-400">500</p>
          <h1 className="text-2xl font-bold">Application Error</h1>
          <p className="text-sm text-slate-400">
            An unexpected error occurred while loading the application. Please try again.
          </p>
          {error.digest && <p className="text-xs text-slate-500">Reference: {error.digest}</p>}
          <div className="pt-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
