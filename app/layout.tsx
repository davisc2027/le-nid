import type { Metadata, Viewport } from "next";
import { Nunito, EB_Garamond } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const garamond = EB_Garamond({ variable: "--font-garamond", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Le Nid",
  description: "Strasbourg mission trip companion",
  appleWebApp: { capable: true, title: "Le Nid", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#a8412e" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${garamond.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
