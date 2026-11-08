/**
 * Dua Dev wordmark — the real mark, lifted directly from the marketing site's
 * own Navbar component (an inline SVG: "DUA" 800-weight + "DEV" 400-weight in
 * Poppins, a cyan underline bar, and a cyan accent square). `dark` swaps the
 * text fill for use on the navy sidebar; `showTagline` adds the small
 * "Building Scalable Software Solutions" line used under the mark on the site.
 */
export function Logo({
  dark = false,
  className = "h-8 w-auto",
  showTagline = false,
  compact = false,
}: {
  dark?: boolean;
  className?: string;
  showTagline?: boolean;
  compact?: boolean;
}) {
  const textColor = dark ? "#ffffff" : "#0f172a";

  if (compact) {
    // Icon-only derivative of the real mark: "DD" (the initials of DUA DEV,
    // bold + regular exactly like the full wordmark), the cyan underline bar
    // under the first D, and the cyan accent dot.
    return (
      <svg
        className={className}
        viewBox="0 0 100 84"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="DUA DEV"
      >
        <text x="0" y="56" fontFamily="Poppins, sans-serif" fontSize="56" fontWeight="800" fill={textColor}>
          D
        </text>
        <text x="40" y="56" fontFamily="Poppins, sans-serif" fontSize="56" fontWeight="400" fill={textColor}>
          D
        </text>
        <rect x="0" y="64" width="36" height="6" fill="hsl(187 85% 43%)" rx="3" />
        <rect x="82" y="42" width="14" height="14" fill="hsl(187 85% 43%)" rx="2" />
      </svg>
    );
  }

  const mark = (
    <svg
      className={className}
      viewBox="0 0 290 95"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="DUA DEV Logo"
    >
      <text x="0" y="75" fontFamily="Poppins, sans-serif" fontSize="60" fontWeight="800" fill={textColor}>
        DUA
      </text>
      <text x="130" y="75" fontFamily="Poppins, sans-serif" fontSize="60" fontWeight="400" fill={textColor}>
        DEV
      </text>
      <rect x="0" y="85" width="115" height="6" fill="hsl(187 85% 43%)" rx="3" />
      <rect x="260" y="55" width="20" height="20" fill="hsl(187 85% 43%)" />
    </svg>
  );

  if (!showTagline) return mark;

  return (
    <span className="inline-flex flex-col items-start">
      {mark}
      <span
        className={`-mt-1 text-[9px] font-medium leading-none whitespace-nowrap ${dark ? "text-white/70" : "text-gray-500"}`}
      >
        Building <span className="text-brand-500">Scalable Software</span> Solutions
      </span>
    </span>
  );
}
