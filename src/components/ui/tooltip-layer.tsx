"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * App-wide custom tooltips.
 *
 * The browser's own `title` tooltip is an unstyled, delayed OS box that ignores the theme. This layer
 * replaces it everywhere: the first time an element with a `title` attribute is hovered or focused,
 * the text is moved to `data-tooltip` (so the native popup never appears) and shown as a styled popup
 * instead. Nothing has to opt in — existing `title="..."` props keep working — and new code can also
 * set `data-tooltip="..."` directly.
 *
 * Accessibility: icon-only controls get an `aria-label` from the tooltip text if they have no name,
 * the popup is `role="tooltip"`, and it shows on keyboard focus as well as hover and hides on Escape.
 */

type Tip = { text: string; x: number; y: number; below: boolean };

const SHOW_DELAY = 220;
const MAX_LEVELS = 6;

/** The element (self or ancestor) whose tooltip applies, converting a native `title` on first sight. */
function tooltipHost(start: EventTarget | null): { el: Element; text: string } | null {
  let el = start instanceof Element ? start : null;
  for (let i = 0; el && i < MAX_LEVELS; i++, el = el.parentElement) {
    const native = el.getAttribute("title");
    if (native && native.trim()) {
      el.setAttribute("data-tooltip", native.trim());
      el.removeAttribute("title"); // stops the browser's own tooltip
      if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.textContent?.trim()) {
        el.setAttribute("aria-label", native.trim());
      }
    }
    const text = el.getAttribute("data-tooltip");
    if (text) return { el, text };
  }
  return null;
}

const emptySubscribe = () => () => {};

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const host = useRef<Element | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bubbleWidth, setBubbleWidth] = useState(0);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    function hide() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      host.current = null;
      setTip(null);
    }

    function show(target: EventTarget | null, immediate = false) {
      const found = tooltipHost(target);
      if (!found) return;
      if (found.el === host.current) return;
      hide();
      host.current = found.el;
      const open = () => {
        if (host.current !== found.el || !found.el.isConnected) return;
        const r = found.el.getBoundingClientRect();
        const below = r.top < 56; // no room above (e.g. the top bar) -> open underneath
        setTip({ text: found.text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
      };
      if (immediate) open();
      else timer.current = setTimeout(open, SHOW_DELAY);
    }

    const onOver = (e: MouseEvent) => show(e.target);
    const onOut = (e: MouseEvent) => {
      const h = host.current;
      if (h && !(e.relatedTarget instanceof Node && h.contains(e.relatedTarget))) hide();
    };
    const onFocus = (e: FocusEvent) => show(e.target, true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", hide, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", hide, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!mounted || !tip) return null;

  const left = tip.x - bubbleWidth / 2;
  const margin = 8;
  const shift =
    bubbleWidth > 0 && typeof window !== "undefined"
      ? Math.max(margin - left, Math.min(0, window.innerWidth - margin - (left + bubbleWidth)))
      : 0;

  return createPortal(
    <div
      ref={(node) => {
        if (node) {
          const w = node.offsetWidth;
          if (w !== bubbleWidth) setBubbleWidth(w);
        }
      }}
      role="tooltip"
      className="tooltip-pop pointer-events-none fixed z-[300] max-w-[280px] rounded-lg bg-navy-950 px-2.5 py-1.5 text-xs leading-snug font-medium text-white shadow-lg ring-1 ring-white/10"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(calc(-50% + ${shift}px), ${tip.below ? "0" : "-100%"})`,
      }}
    >
      {tip.text}
      <span
        aria-hidden
        className="absolute h-2 w-2 rotate-45 bg-navy-950"
        style={{
          left: `calc(50% - ${shift}px - 4px)`,
          ...(tip.below ? { top: -4 } : { bottom: -4 }),
        }}
      />
    </div>,
    document.body
  );
}
