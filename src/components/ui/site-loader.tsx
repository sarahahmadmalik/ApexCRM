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
      <svg viewBox="0 0 185 60" className="site-loader-svg" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <g transform="translate(18 6)">
          <path
            d="M24 6 L8 40 H17.5 L24 25.5 L30.5 40 H40 L24 6 Z"
            stroke="#ffffff"
            strokeWidth="1.5"
            fill="#ffffff"
            className="sl-draw"
          />
          <path d="M24 25.5 L19.5 35.5 H28.5 L24 25.5 Z" fill={CYAN} className="sl-sq" />
          <text
            x="52"
            y="35"
            fontFamily="Poppins, sans-serif"
            fontSize="32"
            fontWeight="600"
            letterSpacing="-0.8"
            className="sl-draw sl-draw-2"
          >
            apex
          </text>
          <circle cx="138" cy="31" r="3.5" fill={CYAN} className="sl-node" style={{ animationDelay: "1.1s" }} />
        </g>
      </svg>
      <p className="site-loader-caption">{caption}</p>
      <span className="site-loader-bar" />
    </div>
  );
}
