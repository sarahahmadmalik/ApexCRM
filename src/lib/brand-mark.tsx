/**
 * The ApexCRM app mark used for browser tab and home-screen icons: a dark navy tile
 * with the hexagonal cyan prism summit and white center node.
 */
export function BrandMark({ size, rounded = true }: { size: number; rounded?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx={rounded ? 14 : 0} fill="#0B132B" />
      <path
        d="M32 7 L54 19.5 V44.5 L32 57 L10 44.5 V19.5 Z"
        fill="rgba(6,182,212,0.16)"
        stroke="#06B6D4"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M32 15 L16 46 H28 L32 31 Z" fill="#22D3EE" />
      <path d="M32 15 L48 46 H36 L32 31 Z" fill="#0891B2" />
      <circle cx="32" cy="43" r="3.8" fill="#FFFFFF" />
    </svg>
  );
}
