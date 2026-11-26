import { createClient, getProfile } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import ReplayTour from "@/components/ReplayTour";
import GentleToggle from "@/components/french/GentleToggle";
import SpeakingToggle from "@/components/speech/SpeakingToggle";
import EmergencyInfoForm from "@/components/EmergencyInfoForm";
import { loadMyExtras } from "@/lib/my-extras";
import Link from "next/link";
import { LifeBuoy, ShieldCheck } from "lucide-react";

export default async function Me() {
  const supabase = await createClient();
  const [{ data: claims }, profile] = await Promise.all([supabase.auth.getClaims(), getProfile()]);
  const user = { id: profile?.id ?? claims?.claims.sub ?? "", email: (claims?.claims.email as string | undefined) ?? "" };
  const [{ data: p }, extras] = await Promise.all([
    supabase.from("profiles").select("name, leaderboard_opt_in, team").eq("id", user.id).single(),
    loadMyExtras(supabase), // null before migration 0021: the emergency card stays hidden
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Me</h1>
      <p className="text-sm text-muted">{user.email}</p>
      <ProfileForm id={user.id} name={p?.name ?? ""} optIn={!!p?.leaderboard_opt_in} team={p?.team ?? null} />
      <Link href="/emergency" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-danger bg-surface px-4 py-2 font-bold text-danger"><LifeBuoy size={20} aria-hidden="true" />Emergency numbers and contacts</Link>
      {extras && <EmergencyInfoForm initial={extras} />}
      <div className="card flex flex-col gap-2"><h2 className="label">French practice</h2><SpeakingToggle /></div>
      <ReplayTour />
      <GentleToggle />
      <Link href="/privacy" className="inline-flex min-h-11 items-center gap-2 self-start px-1 text-sm text-muted underline"><ShieldCheck size={18} aria-hidden="true" />Privacy notice{extras?.privacy_ack_at ? ` (you accepted it on ${new Date(extras.privacy_ack_at).toLocaleDateString("en-US", { dateStyle: "medium" })})` : ""}</Link>
    </div>
  );
}
