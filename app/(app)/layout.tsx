import Link from "next/link";
import { Settings, Trophy } from "lucide-react";
import Script from "next/script";
import { createClient, getProfile } from "@/lib/supabase/server";
import Logo from "@/components/art/Logo";
import BottomNav from "@/components/BottomNav";
import RouteBackdrop from "@/components/RouteBackdrop";
import TourHost from "@/components/TourHost";
import { after } from "next/server";
import { notifyAdminsOfRequest } from "@/lib/notify";
import PendingScreen from "@/components/PendingScreen";

const iconLink = "flex min-h-11 min-w-12 flex-col items-center justify-center rounded-xl text-lg leading-none hover:bg-tint";
const iconLabel = "mt-0.5 text-[11px] font-bold text-muted";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile();
  if (profile?.status === "pending") after(() => notifyAdminsOfRequest({ id: profile.id, name: profile.name }));
  if (profile && profile.status !== "approved") return <PendingScreen id={profile.id} name={profile.name} rejected={profile.status === "rejected"} />;
  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";
  const [waiting, { count }] = await Promise.all([
    !isAdmin ? 0 : (async () => {
      // pending_count() exists after migration 0010; fall back to counting the people list until then.
      const r = await supabase.rpc("pending_count");
      if (!r.error && r.data != null) return Number(r.data);
      const old = await supabase.rpc("admin_list_people");
      return (old.data as { status?: string }[] | null)?.filter((p) => p.status === "pending").length ?? 0;
    })(),
    profile
      ? supabase.from("todo_assignments").select("todo_id", { count: "exact", head: true }).eq("user_id", profile.id).is("completed_at", null)
      : Promise.resolve({ count: 0 }),
  ]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-4 pt-7">
        <Link href="/" aria-label="Home"><Logo size={36} /></Link>
        <div className="flex items-center">
          <Link href="/together" className="mr-1 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-3 text-sm font-extrabold text-[#2b2118] shadow-sm"><Trophy size={18} strokeWidth={2.4} aria-hidden="true" />Leaderboard</Link>
          {profile?.role === "admin" && <Link href="/admin" className={iconLink}><span aria-hidden="true" className="relative"><Settings size={22} />{waiting > 0 && <span className="absolute -right-3 -top-2 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-extrabold leading-4 text-[#2b2118]">{waiting}</span>}</span><span className={iconLabel}>Admin</span></Link>}
          <Link href="/me" aria-label="Me" className="grid size-11 place-items-center">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-fg">{(profile?.name || "?")[0].toUpperCase()}</span>
          </Link>
        </div>
      </header>
      <RouteBackdrop />
      <main className="flex-1 px-4 py-4">{children}</main>
      <Script id="sw" strategy="afterInteractive">{`if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});`}</Script>
      <BottomNav openTodos={count ?? 0} />
      <TourHost />
    </div>
  );
}
