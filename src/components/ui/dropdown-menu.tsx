"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Shared popover-menu shell: trigger + outside-click-to-close + the one
 * `dropdown-menu-pop` open/close animation, reused everywhere a click opens
 * a small floating panel (status pickers, the country switcher, the profile
 * menu, theme switcher). Keeps every dropdown in the app opening/closing the
 * same way instead of each place reimplementing its own open-state + ref.
 *
 * `portal` renders the panel into <body> with fixed positioning — use it
 * inside anything that scrolls or clips (table rows, drawers/dialogs), where
 * an absolutely positioned panel would be cut off or would stretch the
 * scrollable area. The panel is sized to fit the space left in the viewport.
 * `matchTriggerWidth` makes it at least as wide as the trigger (form selects).
 */
export function DropdownMenu({
  trigger,
  children,
  align = "right",
  panelClassName,
  panelId,
  portal = false,
  matchTriggerWidth = false,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
  /** Lets a trigger point at the panel with aria-controls. */
  panelId?: string;
  portal?: boolean;
  matchTriggerWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left?: number;
    right?: number;
    flip: boolean;
    maxHeight: number;
    minWidth?: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  // Portal mode: pin the panel to the trigger, flip above it when there's
  // more room there, cap its height to the space available, and close on
  // page scroll/resize rather than drift away. Scrolling *inside* the panel
  // (a long option list) must not count, or the list could never be scrolled.
  useLayoutEffect(() => {
    if (!open || !portal || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const margin = 12;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const flip = below < 240 && above > below;
    setCoords({
      top: flip ? rect.top - 6 : rect.bottom + 6,
      ...(align === "right" ? { right: window.innerWidth - rect.right } : { left: rect.left }),
      flip,
      maxHeight: Math.max(160, (flip ? above : below) - 6),
      minWidth: matchTriggerWidth ? rect.width : undefined,
    });
    const close = () => setOpen(false);
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, portal, align, matchTriggerWidth]);

  const panelBase =
    "dropdown-menu-pop z-[110] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl dark:border-white/10 dark:bg-navy-800";

  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && !portal && (
        <div
          id={panelId}
          className={cn(
            panelBase,
            "absolute top-full mt-1.5",
            align === "right" ? "right-0" : "left-0",
            panelClassName
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
      {open &&
        portal &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className={cn(panelBase, "fixed flex flex-col", panelClassName)}
            style={{
              top: coords.top,
              left: coords.left,
              right: coords.right,
              maxHeight: coords.maxHeight,
              minWidth: coords.minWidth,
              transform: coords.flip ? "translateY(-100%)" : undefined,
            }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body
        )}
    </div>
  );
}
