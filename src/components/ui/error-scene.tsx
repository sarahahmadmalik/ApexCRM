import { cn } from "@/lib/utils";

/**
 * The shared "something is wrong" screen (404, no access, unexpected error): the running dino scene, the
 * status code, a title and message, and action buttons. Follows the light / dark theme like every page.
 */
export function ErrorScene({
  code,
  title,
  message,
  children,
  className,
}: {
  code: string;
  title: string;
  message: string;
  /** Action buttons / links. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[70vh] flex-1 items-center justify-center px-6 py-12", className)}>
      <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <div className="dino-loader" aria-hidden>
          <div className="dino-runner" />
          <div className="dino-obstacle" />
          <div className="dino-ground" />
        </div>

        <p className="font-display mt-8 bg-gradient-to-b from-brand-500 to-brand-700 bg-clip-text text-6xl leading-none font-extrabold tracking-tight text-transparent sm:text-7xl dark:from-brand-300 dark:to-brand-600">
          {code}
        </p>
        <h1 className="font-display mt-3 text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">{message}</p>

        {children && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>}
      </div>
    </div>
  );
}

/** Primary action link styling shared by the error screens. */
export const errorActionClass =
  "inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-brand-600 hover:shadow-[0_0_0_3px_rgba(6,182,212,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.97]";
