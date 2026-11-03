"use client";

import { usePathname } from "next/navigation";
import Backdrop from "@/components/art/Backdrop";

/** The Strasbourg scene sits behind every page except the leaderboard, the scripture screens (stained-glass skin),
 *  conversation mode, admin, Three Circles (the drawing needs a clean page) and full-screen lesson drills. Home gets it gently blurred so it never competes with the content. */
export default function RouteBackdrop() {
  const path = usePathname();
  const skip = path.startsWith("/together") || path.startsWith("/scripture") || path.startsWith("/translate/talk") || path.startsWith("/admin") || path.startsWith("/learn/three-circles") || /^\/french\/./.test(path);
  return skip ? null : <Backdrop soft={path === "/"} />;
}
