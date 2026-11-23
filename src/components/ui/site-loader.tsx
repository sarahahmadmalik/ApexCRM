"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen splash that plays on every full page load of the signed-in app (first open, browser refresh) and,
 * for a few seconds longer with a welcome line, right after signing in. It draws the complete Dua Dev logo
 * (the wordmark is traced stroke by stroke, then filled), and then draws a growth line rising from the left
 * that ends in the logo's cyan accent square, which pops in as the goal. Pure SVG + CSS keyframes
 * (see the "Site loader" block in globals.css): it needs no JavaScript, so it never flashes or gets stuck.
 *
 * It lives in the signed-in layout, which stays mounted while people move between pages, so moving between
 * pages does not replay it; only a real reload does.
 *
 * It stays up until the page is actually ready: the animation has played for a minimum time, the browser has
 * finished loading, and the page's loading skeletons are gone (the data has arrived). A safety cap closes it
 * anyway, so it can never get stuck.
 */
const CYAN = "hsl(187 85% 43%)";

const MIN_MS = 2200;
const MIN_SHOWCASE_MS = 3200;
const MAX_MS = 12_000;
const FADE_MS = 450;

export function SiteLoader({ showcase = false, caption = "Loading your workspace" }: { showcase?: boolean; caption?: string }) {
  const [hiding, setHiding] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const started = performance.now();
    const minMs = showcase ? MIN_SHOWCASE_MS : MIN_MS;
    let closed = false;

    const ready = () =>
      performance.now() - started >= minMs && document.readyState === "complete" && !document.querySelector(".animate-skeleton");

    const close = () => {
      if (closed) return;
      closed = true;
      observer.disconnect();
      setHiding(true);
    };
    const check = () => {
      if (ready()) close();
    };

    // The page streams in: re-check whenever the DOM changes (skeletons being replaced by real content).
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("load", check);
    const minTimer = setTimeout(check, minMs + 50);
    const poll = setInterval(check, 400);
    const cap = setTimeout(close, MAX_MS);

    return () => {
      closed = true;
      observer.disconnect();
      window.removeEventListener("load", check);
      clearTimeout(minTimer);
      clearInterval(poll);
      clearTimeout(cap);
    };
  }, [showcase]);

  useEffect(() => {
    if (!hiding) return;
    const t = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(t);
  }, [hiding]);

  if (gone) return null;

  return (
    <div
      className={["site-loader", showcase ? "site-loader--showcase" : "", hiding ? "site-loader--hide" : ""].filter(Boolean).join(" ")}
      role="status"
      aria-label="Loading ApexCRM"
    >
      <svg viewBox="0 0 64 64" className="h-20 w-20 overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        {/* Only the geometric Apex logo mark sketching up */}
        <path
          d="M32 8 L10 52 H22.5 L32 32.5 L41.5 52 H54 L32 8 Z"
          className="sl-draw"
        />
        <path
          d="M32 33 L25.5 47 H38.5 L32 33 Z"
          fill={CYAN}
          className="sl-sq"
        />
      </svg>
      <p className="site-loader-caption">{caption}</p>
      <span className="site-loader-bar" />
    </div>
  );
}
