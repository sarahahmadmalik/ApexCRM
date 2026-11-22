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
      <svg viewBox="-6 0 342 150" className="site-loader-svg" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <g transform="translate(8 14)">
          {/* Hexagonal Prism Emblem */}
          <path
            d="M36 4 L64 20 V52 L36 68 L8 52 V20 Z"
            stroke={CYAN}
            strokeWidth="2.5"
            fill="rgba(6,182,212,0.12)"
            className="sl-line"
            pathLength={1}
          />
          <path d="M36 14 L16 52 H31 L36 34 Z" fill="#22d3ee" className="sl-sq" />
          <path d="M36 14 L56 52 H41 L36 34 Z" fill={CYAN} className="sl-sq" />
          <circle cx="36" cy="48" r="4.2" fill="#ffffff" className="sl-node" style={{ animationDelay: "0.9s" }} />

          {/* "Apex" Logotype + "CRM" Pill Badge */}
          <text x="82" y="55" fontFamily="Poppins, sans-serif" fontSize="44" fontWeight="700" className="sl-draw">
            Apex
          </text>
          <g transform="translate(206, 22)">
            <rect x="0" y="0" width="98" height="38" rx="11" fill="rgba(6,182,212,0.18)" stroke={CYAN} strokeWidth="2" className="sl-bar" />
            <circle cx="17" cy="19" r="4" fill={CYAN} className="sl-node" style={{ animationDelay: "1.1s" }} />
            <text x="30" y="26" fontFamily="Poppins, sans-serif" fontSize="21" fontWeight="800" letterSpacing="1.5" className="sl-draw sl-draw-2">
              CRM
            </text>
          </g>
        </g>
      </svg>
      <p className="site-loader-caption">{caption}</p>
      <span className="site-loader-bar" />
    </div>
  );
}
