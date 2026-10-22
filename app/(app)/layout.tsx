import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import Logo from "@/components/art/Logo";
import TranslateFab from "@/components/TranslateFab";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile();
  const tabs = [
    { href: "/", label: "Home" },
    { href: "/itinerary", label: "Itinerary" },
    { href: "/todos", label: "To-dos" },
    { href: "/french", label: "French" },
    { href: "/scripture", label: "Verses" },
    { href: "/files", label: "Files" },
    ...(profile?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col pb-20">
      <header className="flex items-center justify-between px-4 pt-3">
        <Logo size={36} />
        <div className="flex gap-2 text-sm font-bold text-primary">
          <Link href="/together" aria-label="Together: leaderboard and group goal">🏆</Link>
          <Link href="/me">Me</Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
      <TranslateFab />
      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-surface">
        <div className="mx-auto flex max-w-xl justify-around py-3 text-xs font-bold">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className="px-3 text-primary">{t.label}</Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
