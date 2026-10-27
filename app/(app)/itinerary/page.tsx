import { createClient } from "@/lib/supabase/server";
import ItineraryView from "@/components/itinerary/ItineraryView";
import type { ItineraryItem } from "@/lib/itinerary";

export default async function Itinerary() {
  const supabase = await createClient();
  // select("*") so this keeps working before migration 0016 (no tz / updated_at columns yet).
  const { data } = await supabase.from("itinerary_items").select("*").order("day").order("start_time");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Itinerary</h1>
        <p className="text-sm text-muted">Times are local to where we are: Texas time before we land, Strasbourg time after.</p>
      </div>
      <ItineraryView items={(data ?? []) as ItineraryItem[]} />
    </div>
  );
}
