import { ImageResponse } from "next/og";

// Placeholder app icon until real art exists. Swap this route for static PNGs in /public/icons later.
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const px = size === "512" ? 512 : size === "180" ? 180 : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#a8412e", color: "#fbf6ee", fontSize: px * 0.5, fontWeight: 800 }}>
        LN
      </div>
    ),
    { width: px, height: px },
  );
}
