import { Globe } from "lucide-react";
import { findCountry } from "@/lib/data/geo";
import { cn } from "@/lib/utils";

/**
 * Inline SVG flags for the target markets. Emoji flags aren't used because
 * Windows renders them as bare letters ("DE"), so every flag is drawn here on
 * a 3:2 canvas. Unknown countries fall back to a globe icon.
 */
const FLAGS: Record<string, React.ReactNode> = {
  DE: (
    <>
      <rect width="30" height="6.67" fill="#000000" />
      <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
      <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
    </>
  ),
  FR: (
    <>
      <rect width="10" height="20" fill="#002395" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#ED2939" />
    </>
  ),
  BE: (
    <>
      <rect width="10" height="20" fill="#000000" />
      <rect x="10" width="10" height="20" fill="#FAE042" />
      <rect x="20" width="10" height="20" fill="#ED2939" />
    </>
  ),
  IT: (
    <>
      <rect width="10" height="20" fill="#009246" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#CE2B37" />
    </>
  ),
  SE: (
    <>
      <rect width="30" height="20" fill="#006AA7" />
      <rect x="9" width="4" height="20" fill="#FECC00" />
      <rect y="8" width="30" height="4" fill="#FECC00" />
    </>
  ),
  FI: (
    <>
      <rect width="30" height="20" fill="#FFFFFF" />
      <rect x="8" width="5" height="20" fill="#002F6C" />
      <rect y="7.5" width="30" height="5" fill="#002F6C" />
    </>
  ),
  AT: (
    <>
      <rect width="30" height="6.67" fill="#ED2939" />
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#ED2939" />
    </>
  ),
  NL: (
    <>
      <rect width="30" height="6.67" fill="#AE1C28" />
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#21468B" />
    </>
  ),
  ES: (
    <>
      <rect width="30" height="20" fill="#AA151B" />
      <rect y="5" width="30" height="10" fill="#F1BF00" />
    </>
  ),
  PT: (
    <>
      <rect width="30" height="20" fill="#FF0000" />
      <rect width="12" height="20" fill="#006600" />
      <circle cx="12" cy="10" r="3.6" fill="#FFCC00" />
      <circle cx="12" cy="10" r="2" fill="#FF0000" />
    </>
  ),
  IE: (
    <>
      <rect width="10" height="20" fill="#169B62" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#FF883E" />
    </>
  ),
  DK: (
    <>
      <rect width="30" height="20" fill="#C8102E" />
      <rect x="9" width="3.5" height="20" fill="#FFFFFF" />
      <rect y="8.25" width="30" height="3.5" fill="#FFFFFF" />
    </>
  ),
  PL: (
    <>
      <rect width="30" height="10" fill="#FFFFFF" />
      <rect y="10" width="30" height="10" fill="#DC143C" />
    </>
  ),
  CZ: (
    <>
      <rect width="30" height="10" fill="#FFFFFF" />
      <rect y="10" width="30" height="10" fill="#D7141A" />
      <path d="M0 0 L15 10 L0 20 Z" fill="#11457E" />
    </>
  ),
  SK: (
    <>
      <rect width="30" height="6.67" fill="#FFFFFF" />
      <rect y="6.67" width="30" height="6.67" fill="#0B4EA2" />
      <rect y="13.33" width="30" height="6.67" fill="#EE1C25" />
      <path d="M8 5 h6 v6 q0 4 -3 5 q-3 -1 -3 -5 Z" fill="#EE1C25" stroke="#FFFFFF" strokeWidth="0.8" />
    </>
  ),
  HU: (
    <>
      <rect width="30" height="6.67" fill="#CD2A3E" />
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#436F4D" />
    </>
  ),
  RO: (
    <>
      <rect width="10" height="20" fill="#002B7F" />
      <rect x="10" width="10" height="20" fill="#FCD116" />
      <rect x="20" width="10" height="20" fill="#CE1126" />
    </>
  ),
  BG: (
    <>
      <rect width="30" height="6.67" fill="#FFFFFF" />
      <rect y="6.67" width="30" height="6.67" fill="#00966E" />
      <rect y="13.33" width="30" height="6.67" fill="#D62612" />
    </>
  ),
  HR: (
    <>
      <rect width="30" height="6.67" fill="#FF0000" />
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#171796" />
      <rect x="12.5" y="7.5" width="5" height="5" fill="#FF0000" stroke="#FFFFFF" strokeWidth="0.6" />
    </>
  ),
  SI: (
    <>
      <rect width="30" height="6.67" fill="#FFFFFF" />
      <rect y="6.67" width="30" height="6.67" fill="#005DA4" />
      <rect y="13.33" width="30" height="6.67" fill="#ED1C24" />
    </>
  ),
  GR: (
    <>
      <rect width="30" height="20" fill="#0D5EAF" />
      <rect y="2.22" width="30" height="2.22" fill="#FFFFFF" />
      <rect y="6.67" width="30" height="2.22" fill="#FFFFFF" />
      <rect y="11.11" width="30" height="2.22" fill="#FFFFFF" />
      <rect y="15.56" width="30" height="2.22" fill="#FFFFFF" />
      <rect width="11.1" height="11.1" fill="#0D5EAF" />
      <rect x="4.4" width="2.3" height="11.1" fill="#FFFFFF" />
      <rect y="4.4" width="11.1" height="2.3" fill="#FFFFFF" />
    </>
  ),
  LT: (
    <>
      <rect width="30" height="6.67" fill="#FDB913" />
      <rect y="6.67" width="30" height="6.67" fill="#006A44" />
      <rect y="13.33" width="30" height="6.67" fill="#C1272D" />
    </>
  ),
  LV: (
    <>
      <rect width="30" height="20" fill="#9E3039" />
      <rect y="8" width="30" height="4" fill="#FFFFFF" />
    </>
  ),
  EE: (
    <>
      <rect width="30" height="6.67" fill="#0072CE" />
      <rect y="6.67" width="30" height="6.67" fill="#000000" />
      <rect y="13.33" width="30" height="6.67" fill="#FFFFFF" />
    </>
  ),
  LU: (
    <>
      <rect width="30" height="6.67" fill="#ED2939" />
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#00A1DE" />
    </>
  ),
  MT: (
    <>
      <rect width="15" height="20" fill="#FFFFFF" />
      <rect x="15" width="15" height="20" fill="#CF142B" />
      <rect x="3" y="3" width="4" height="4" fill="#B0B0B0" />
    </>
  ),
  CY: (
    <>
      <rect width="30" height="20" fill="#FFFFFF" />
      <path d="M8 8 q3 -2.5 7 -1 q4 -1 7 1.5 q-3 3.5 -7 2.5 q-4 1 -7 -3 Z" fill="#D57800" />
      <path d="M10 14 q5 2 10 0" fill="none" stroke="#4E5B31" strokeWidth="1.2" />
    </>
  ),
};

export function CountryFlag({ country, className }: { country: string | null | undefined; className?: string }) {
  const iso2 = country ? findCountry(country)?.iso2 : undefined;
  const flag = iso2 ? FLAGS[iso2] : undefined;

  if (!flag) {
    return <Globe aria-hidden className={cn("h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500", className)} />;
  }

  return (
    <svg
      viewBox="0 0 30 20"
      role="img"
      aria-label={`${country} flag`}
      className={cn(
        "h-3 w-[18px] shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.15)]",
        className
      )}
    >
      {flag}
    </svg>
  );
}
