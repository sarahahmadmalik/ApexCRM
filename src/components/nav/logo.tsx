/**
 * Minimalist Apex brand mark and wordmark — clean architectural delta/apex
 * geometry paired with refined typography. No pills, tags, or subtitles.
 */
export function Logo({
  dark = false,
  className = "h-8 w-auto",
  compact = false,
}: {
  dark?: boolean;
  className?: string;
  showTagline?: boolean;
  compact?: boolean;
}) {
  const primary = dark ? "#ffffff" : "#0f172a";
  const accent = "#06b6d4";

  if (compact) {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Apex"
      >
        {/* Minimalist architectural Apex mark: two interlocking geometric ribbons */}
        <path
          d="M24 6 L8 40 H17.5 L24 25.5 L30.5 40 H40 L24 6 Z"
          fill={primary}
        />
        <path
          d="M24 25.5 L19.5 35.5 H28.5 L24 25.5 Z"
          fill={accent}
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 185 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Apex"
    >
      {/* Minimalist architectural Apex mark */}
      <path
        d="M24 6 L8 40 H17.5 L24 25.5 L30.5 40 H40 L24 6 Z"
        fill={primary}
      />
      <path
        d="M24 25.5 L19.5 35.5 H28.5 L24 25.5 Z"
        fill={accent}
      />

      {/* Clean, tag-free logotype */}
      <text
        x="52"
        y="35"
        fontFamily="Poppins, sans-serif"
        fontSize="32"
        fontWeight="600"
        letterSpacing="-0.8"
        fill={primary}
      >
        apex
      </text>
      <circle cx="138" cy="31" r="3.5" fill={accent} />
    </svg>
  );
}
