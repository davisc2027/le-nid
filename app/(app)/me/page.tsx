import { createClient, getProfile } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import ReplayTour from "@/components/ReplayTour";
import GentleToggle from "@/components/french/GentleToggle";

export default async function Me() {
  const supabase = await createClient();
  const [{ data: claims }, profile] = await Promise.all([supabase.auth.getClaims(), getProfile()]);
  const user = { id: profile?.id ?? claims?.claims.sub ?? "", email: (claims?.claims.email as string | undefined) ?? "" };
  const { data: p } = await supabase.from("profiles").select("name, leaderboard_opt_in, team").eq("id", user.id).single();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Me</h1>
      <p className="text-sm text-muted">{user.email}</p>
      <ProfileForm id={user.id} name={p?.name ?? ""} optIn={!!p?.leaderboard_opt_in} team={p?.team ?? null} />
      <ReplayTour />
      <GentleToggle />
    </div>
  );
}
