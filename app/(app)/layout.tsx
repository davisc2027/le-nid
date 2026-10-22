import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile();
  const tabs = [
    { href: "/", label: "Home" },
    { href: "/itinerary", label: "Itinerary" },
    { href: "/files", label: "Files" },
    ...(profile?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col pb-20">
      <main className="flex-1 px-4 py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-surface">
        <div className="mx-auto flex max-w-xl justify-around py-3 text-sm font-bold">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className="px-3 text-primary">{t.label}</Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
