import Link from "next/link";
import Script from "next/script";
import { createClient, getProfile } from "@/lib/supabase/server";
import Logo from "@/components/art/Logo";
import RouteTransition from "@/components/ui/RouteTransition";
import BottomNav from "@/components/BottomNav";

const iconLink = "flex min-h-11 min-w-12 flex-col items-center justify-center rounded-xl text-lg leading-none hover:bg-tint";
const iconLabel = "mt-0.5 text-[13px] font-bold text-muted";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile();
  const supabase = await createClient();
  const { count } = profile
    ? await supabase.from("todo_assignments").select("todo_id", { count: "exact", head: true }).eq("user_id", profile.id).is("completed_at", null)
    : { count: 0 };
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-4 pt-2">
        <Link href="/" aria-label="Home"><Logo size={36} /></Link>
        <div className="flex items-center">
          <Link href="/together" className={iconLink}><span aria-hidden="true">🏆</span><span className={iconLabel}>Together</span></Link>
          {profile?.role === "admin" && <Link href="/admin" className={iconLink}><span aria-hidden="true">⚙️</span><span className={iconLabel}>Admin</span></Link>}
          <Link href="/me" aria-label="Me" className="grid size-11 place-items-center">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-fg">{(profile?.name || "?")[0].toUpperCase()}</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-4"><RouteTransition>{children}</RouteTransition></main>
      <Script id="sw" strategy="afterInteractive">{`if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});`}</Script>
      <BottomNav openTodos={count ?? 0} />
    </div>
  );
}
