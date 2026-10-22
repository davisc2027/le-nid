import { ImageResponse } from "next/og";
import Stork from "@/components/art/Stork";

// App icon: Odile on sandstone. Replace with static PNGs in /public/icons once final art exists.
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const px = size === "512" ? 512 : size === "180" ? 180 : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#a8412e" }}>
        <Stork mood="happy" size={px * 0.82} />
      </div>
    ),
    { width: px, height: px },
  );
}
