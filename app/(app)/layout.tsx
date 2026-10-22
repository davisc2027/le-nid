import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import Logo from "@/components/art/Logo";
import BottomNav from "@/components/BottomNav";

const iconLink = "grid size-11 place-items-center rounded-full text-xl hover:bg-tint";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile();
  const supabase = await createClient();
  const { count } = await supabase.from("todo_assignments").select("todo_id", { count: "exact", head: true }).is("completed_at", null);
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-4 pt-2">
        <Link href="/" aria-label="Home"><Logo size={36} /></Link>
        <div className="flex items-center">
          <Link href="/translate" aria-label="Translate" className={iconLink}>🌐</Link>
          <Link href="/together" aria-label="Together: leaderboard and group goal" className={iconLink}>🏆</Link>
          {profile?.role === "admin" && <Link href="/admin" aria-label="Admin" className={iconLink}>⚙️</Link>}
          <Link href="/me" aria-label="Me" className="grid size-11 place-items-center">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-fg">{(profile?.name || "?")[0].toUpperCase()}</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
      <BottomNav openTodos={count ?? 0} />
    </div>
  );
}
