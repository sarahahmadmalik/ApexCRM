/**
 * ApexCRM distinct brand logo — a geometric hexagonal summit/prism emblem paired
 * with the "Apex" logotype and a rounded cyan "CRM" pill badge. Completely
 * distinct in layout, silhouette, and geometry from the Dua Dev wordmark.
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
  const badgeBg = dark ? "rgba(6, 182, 212, 0.18)" : "rgba(6, 182, 212, 0.12)";
  const badgeStroke = "#06b6d4";
  const badgeText = dark ? "#22d3ee" : "#0891b2";

  if (compact) {
    return (
      <svg
        className={className}
        viewBox="0 0 72 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="ApexCRM"
      >
        <defs>
          <linearGradient id="apex-prism-compact-l" x1="12" y1="10" x2="36" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="apex-prism-compact-r" x1="36" y1="10" x2="60" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
        </defs>
        {/* Outer hexagonal badge */}
        <path
          d="M36 4 L63 19.5 V50.5 L36 66 L9 50.5 V19.5 Z"
          fill={dark ? "rgba(6,182,212,0.12)" : "rgba(15,23,42,0.05)"}
          stroke="#06b6d4"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Left prism facet */}
        <path d="M36 14 L17 50 H33 L36 33 Z" fill="url(#apex-prism-compact-l)" />
        {/* Right prism facet */}
        <path d="M36 14 L55 50 H39 L36 33 Z" fill="url(#apex-prism-compact-r)" />
        {/* Floating apex crossbar / core */}
        <circle cx="36" cy="46" r="4" fill={textColor} />
      </svg>
    );
  }

  const mark = (
    <svg
      className={className}
      viewBox="0 0 320 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ApexCRM Logo"
    >
      <defs>
        <linearGradient id="apex-prism-l" x1="12" y1="10" x2="38" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="apex-prism-r" x1="38" y1="10" x2="64" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
      </defs>

      {/* Geometric Hexagonal Prism Emblem */}
      <g transform="translate(2, 4)">
        <path
          d="M36 4 L64 20 V52 L36 68 L8 52 V20 Z"
          fill={dark ? "rgba(6,182,212,0.14)" : "rgba(6,182,212,0.08)"}
          stroke="#06b6d4"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Left ascending wing */}
        <path d="M36 14 L16 52 H31 L36 34 Z" fill="url(#apex-prism-l)" />
        {/* Right ascending wing */}
        <path d="M36 14 L56 52 H41 L36 34 Z" fill="url(#apex-prism-r)" />
        {/* Center nexus node */}
        <circle cx="36" cy="48" r="4.2" fill={textColor} />
      </g>

      {/* "Apex" Logotype */}
      <text
        x="82"
        y="55"
        fontFamily="Poppins, sans-serif"
        fontSize="44"
        fontWeight="700"
        letterSpacing="-1"
        fill={textColor}
      >
        Apex
      </text>

      {/* "CRM" Pill Badge */}
      <g transform="translate(206, 22)">
        <rect
          x="0"
          y="0"
          width="98"
          height="38"
          rx="11"
          fill={badgeBg}
          stroke={badgeStroke}
          strokeWidth="2"
        />
        <circle cx="17" cy="19" r="4" fill="#06b6d4" />
        <text
          x="30"
          y="26"
          fontFamily="Poppins, sans-serif"
          fontSize="21"
          fontWeight="800"
          letterSpacing="1.5"
          fill={badgeText}
        >
          CRM
        </text>
      </g>
    </svg>
  );

  if (!showTagline) return mark;

  return (
    <span className="inline-flex flex-col items-start">
      {mark}
      <span
        className={`-mt-0.5 text-[9px] font-medium leading-none whitespace-nowrap ${dark ? "text-white/70" : "text-gray-500"}`}
      >
        Unified <span className="text-brand-500">CRM &amp; Enterprise</span> Platform
      </span>
    </span>
  );
}
