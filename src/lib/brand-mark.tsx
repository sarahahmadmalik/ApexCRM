/**
 * The Dua Dev app mark used for the browser tab and home-screen icons: a navy tile with a
 * white "D" and the cyan accent square from the wordmark. Drawn as SVG (not text) so it
 * renders identically without any font loading.
 */
export function BrandMark({ size, rounded = true }: { size: number; rounded?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx={rounded ? 14 : 0} fill="#0B132B" />
      <path
        d="M17 15 H29 A17 17 0 0 1 29 49 H17 Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <rect x="44" y="41" width="10" height="10" rx="1.5" fill="#06B6D4" />
    </svg>
  );
}
