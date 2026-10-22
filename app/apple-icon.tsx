import { ImageResponse } from "next/og";
import Stork from "@/components/art/Stork";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#a8412e" }}>
        <Stork mood="happy" size={150} />
      </div>
    ),
    size,
  );
}
