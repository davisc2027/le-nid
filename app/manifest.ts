import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Le Nid",
    short_name: "Le Nid",
    description: "Strasbourg mission trip companion",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6ee",
    theme_color: "#a8412e",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
