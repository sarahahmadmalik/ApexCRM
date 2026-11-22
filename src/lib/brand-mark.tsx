/**
 * Minimalist Apex favicon & app icon mark (Satori / next/og compatible):
 * deep navy tile with the clean white geometric apex peak and cyan inner facet.
 */
export function BrandMark({ size, rounded = true }: { size: number; rounded?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx={rounded ? 16 : 0} fill="#0B132B" />
      <path
        d="M32 12 L13 50 H23.5 L32 32 L40.5 50 H51 L32 12 Z"
        fill="#FFFFFF"
      />
      <path
        d="M32 33 L26 46 H38 L32 33 Z"
        fill="#06B6D4"
      />
    </svg>
  );
}
