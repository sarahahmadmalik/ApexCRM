/**
 * Minimalist Apex CRM brand mark and wordmark — tight optical spacing between
 * the architectural delta mark, "apex" logotype, and smaller cyan "CRM" label.
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
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Apex CRM"
      >
        <path
          d="M22 5 L6 39 H15.5 L22 24.5 L28.5 39 H38 L22 5 Z"
          fill={primary}
        />
        <path
          d="M22 24.5 L17.5 34.5 H26.5 L22 24.5 Z"
          fill={accent}
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 176 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Apex CRM"
    >
      {/* Architectural Apex mark (x: 4..36) */}
      <path
        d="M20 5 L4 39 H13.5 L20 24.5 L26.5 39 H36 L20 5 Z"
        fill={primary}
      />
      <path
        d="M20 24.5 L15.5 34.5 H24.5 L20 24.5 Z"
        fill={accent}
      />

      {/* Tightly kerned "apex" wordmark + smaller cyan "CRM" */}
      <text
        x="40"
        y="34"
        fontFamily="Poppins, sans-serif"
        fontSize="31"
        fontWeight="600"
        letterSpacing="-0.9"
        fill={primary}
      >
        apex
      </text>
      <text
        x="120"
        y="34"
        fontFamily="Poppins, sans-serif"
        fontSize="14"
        fontWeight="700"
        letterSpacing="1.4"
        fill={accent}
      >
        CRM
      </text>
    </svg>
  );
}
