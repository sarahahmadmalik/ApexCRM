/**
 * ApexCRM wordmark — website showcase brand using the same Poppins geometric
 * typography, cyan underline bar, and cyan accent square. `dark` swaps the
 * text fill for use on the navy sidebar; `showTagline` adds the subtitle.
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
    // Icon-only derivative: "AP" monogram with the cyan underline bar and accent dot.
    return (
      <svg
        className={className}
        viewBox="0 0 104 84"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="APEX CRM"
      >
        <text x="0" y="56" fontFamily="Poppins, sans-serif" fontSize="54" fontWeight="800" fill={textColor}>
          A
        </text>
        <text x="42" y="56" fontFamily="Poppins, sans-serif" fontSize="54" fontWeight="400" fill={textColor}>
          P
        </text>
        <rect x="0" y="64" width="38" height="6" fill="hsl(187 85% 43%)" rx="3" />
        <rect x="84" y="42" width="14" height="14" fill="hsl(187 85% 43%)" rx="2" />
      </svg>
    );
  }

  const mark = (
    <svg
      className={className}
      viewBox="0 0 330 95"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="APEX CRM Logo"
    >
      <text x="0" y="75" fontFamily="Poppins, sans-serif" fontSize="58" fontWeight="800" fill={textColor}>
        APEX
      </text>
      <text x="164" y="75" fontFamily="Poppins, sans-serif" fontSize="58" fontWeight="400" fill={textColor}>
        CRM
      </text>
      <rect x="0" y="85" width="148" height="6" fill="hsl(187 85% 43%)" rx="3" />
      <rect x="304" y="55" width="20" height="20" fill="hsl(187 85% 43%)" rx="2" />
    </svg>
  );

  if (!showTagline) return mark;

  return (
    <span className="inline-flex flex-col items-start">
      {mark}
      <span
        className={`-mt-1 text-[9px] font-medium leading-none whitespace-nowrap ${dark ? "text-white/70" : "text-gray-500"}`}
      >
        Unified <span className="text-brand-500">CRM &amp; Operations</span> Suite
      </span>
    </span>
  );
}
