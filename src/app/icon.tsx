import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-mark";

// Next.js App Router convention: this becomes the browser-tab favicon. It is
// the only favicon (there is deliberately no favicon.ico, which browsers would
// prefer over this file).
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BrandMark size={64} />, { ...size });
}
