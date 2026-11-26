import ActionForm from "@/components/admin/ActionForm";
import { resetEmergency, saveEmergency } from "@/app/(app)/admin/actions";
import { GROUPS, LIMITS, itemsToText, type EmergencyContent } from "@/lib/emergency";

/** Admin Settings: edit the Emergency screen. One textarea per group, one line per item. */
export default function EmergencyEditor({ content, missing }: { content: EmergencyContent; missing: boolean }) {
  return (
    <>
      {missing && <p className="text-sm font-semibold">Run migration 0017 (supabase/migrations/0017_app_content.sql) to save changes. The placeholders show until then.</p>}
      <p className="text-xs text-muted">One line per item: <b>Label | text | phone | map link</b>. Phone and map link are optional. Phone numbers become call buttons on the Emergency screen. Up to {LIMITS.items} lines per group, {LIMITS.label} characters for the label and {LIMITS.value} for the text. Leave a group empty to hide it. The 112, 15, 17 and 18 numbers are always shown.</p>
      <ActionForm action={saveEmergency} label="Save emergency info">
        {GROUPS.map((g) => (
          <label key={g.id} className="flex flex-col gap-1 text-sm font-semibold">{g.title}
            <span className="text-xs font-normal text-muted">{g.hint}</span>
            <textarea className="input font-normal" name={`g_${g.id}`} rows={Math.max(3, content[g.id].length + 1)} defaultValue={itemsToText(content[g.id])} spellCheck={false} autoCapitalize="off" />
          </label>
        ))}
      </ActionForm>
      <ActionForm action={resetEmergency} label="Reset to defaults" buttonClass="btn ghost" confirm="Throw away all your changes and go back to the original placeholders?" />
    </>
  );
}
