import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-mark";

// Home-screen icon on iOS / when the tool is pinned.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={180} rounded={false} />, { ...size });
}
