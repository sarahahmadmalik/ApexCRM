"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Modal / slide-over drawer.
 *
 * Rendered through a portal into <body> on purpose: any ancestor with a
 * `transform`, `filter` or `backdrop-filter` becomes the containing block for
 * `position: fixed` children, which previously pinned the drawer inside the
 * page content instead of over the whole viewport. Portalling makes it immune
 * to whatever the page it's opened from happens to be doing.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  position = "center",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Sticky action row pinned to the bottom of the panel. */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** "right" renders a full-height slide-over panel instead of a centered modal. */
  position?: "center" | "right";
}) {
  // Kept mounted through the exit animation, then torn down.
  const [renderOpen, setRenderOpen] = useState(open);
  // Drives the enter transition: mount first with the "closed" transform, then
  // flip this on the next frame so the browser has something to animate from.
  const [entered, setEntered] = useState(false);

  // Adjusting state during render (rather than in an effect) so the panel is
  // already in the tree on the same commit that opens it.
  if (open && !renderOpen) setRenderOpen(true);

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setEntered(false));
    const timer = setTimeout(() => setRenderOpen(false), 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // `document` is absent during SSR; dialogs always start closed, so this
  // only ever short-circuits on the server.
  if (typeof document === "undefined" || !renderOpen) return null;

  const sizeClass = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];

  // Header/footer sit on a tinted surface so the panel reads as three bands
  // rather than one flat sheet.
  const header = (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 bg-gray-50 px-5 py-4 sm:px-6 sm:py-5 dark:border-white/10 dark:bg-navy-900">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        className="shrink-0 cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  const footerRow = footer ? (
    <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6 dark:border-white/10 dark:bg-navy-900">
      {footer}
    </div>
  ) : null;

  const content =
    position === "right" ? (
      <div
        className={cn(
          "fixed inset-0 z-[100] flex justify-end bg-navy-900/40 backdrop-blur-[2px] transition-opacity duration-200",
          entered ? "opacity-100" : "opacity-0"
        )}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-200 ease-out dark:bg-navy-800",
            sizeClass,
            entered ? "translate-x-0" : "translate-x-full"
          )}
        >
          {header}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footerRow}
        </div>
      </div>
    ) : (
      <div
        className={cn(
          "fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-navy-900/40 px-4 py-6 backdrop-blur-[2px] transition-opacity duration-200 sm:py-8",
          entered ? "opacity-100" : "opacity-0"
        )}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "flex max-h-full w-full flex-col rounded-xl bg-white shadow-xl ring-1 ring-black/5 transition-all duration-200 ease-out dark:bg-navy-800 dark:ring-white/10",
            sizeClass,
            entered ? "translate-y-0 scale-100 opacity-100" : "-translate-y-3 scale-95 opacity-0"
          )}
        >
          {header}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footerRow}
        </div>
      </div>
    );

  return createPortal(content, document.body);
}
