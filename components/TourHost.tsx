"use client";

import dynamic from "next/dynamic";

// Lazy: the tour code only loads on the client, and only the Me page's replay button or a first visit needs it.
const WelcomeTour = dynamic(() => import("./WelcomeTour"), { ssr: false });

export default function TourHost() {
  return <WelcomeTour auto />;
}
