"use client";

import { usePathname } from "next/navigation";
import Backdrop from "@/components/art/Backdrop";

/** The Strasbourg scene sits behind every page except Home and the leaderboard (which have their own focus),
 *  the scripture screens (stained-glass skin), and full-screen lesson drills. */
export default function RouteBackdrop() {
  const path = usePathname();
  const skip = path === "/" || path.startsWith("/together") || path.startsWith("/scripture") || /^\/french\/./.test(path);
  // Fainter behind the translate screens so the scene never competes with the buttons.
  return skip ? null : <Backdrop faded={path.startsWith("/translate")} />;
}
