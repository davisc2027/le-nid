import ActionForm from "@/components/admin/ActionForm";
import { resetPrivacy, savePrivacy } from "@/app/(app)/admin/actions";
import { SECTIONS, placeholders, type PrivacyContent } from "@/lib/privacy";

/** Admin Settings: edit the privacy notice. One textarea per section; lines starting with "- " show as bullets. */
export default function PrivacyEditor({ content, missing }: { content: PrivacyContent; missing: boolean }) {
  const left = placeholders(content);
  return (
    <>
      {missing && <p className="text-sm font-semibold">Run migration 0017 (supabase/migrations/0017_app_content.sql) to save changes. The standard wording shows until then.</p>}
      {left.length > 0
        ? <p className="rounded-xl bg-tint p-3 text-sm font-semibold" role="status">Still to fill in before the trip: {left.join(", ")}. Replace each [bracketed] placeholder with the real answer.</p>
        : <p className="text-sm font-semibold text-good">No placeholders left.</p>}
      <p className="text-xs text-muted">Plain English. Start a line with &quot;- &quot; for a bullet. People see this at <b>/privacy</b> and the short summary on their first-time consent screen.</p>
      <ActionForm action={savePrivacy} label="Save privacy notice">
        {SECTIONS.map((s) => (
          <label key={s.id} className="flex flex-col gap-1 text-sm font-semibold">{s.title}
            <textarea className="input font-normal" name={`p_${s.id}`} rows={s.id === "summary" ? 5 : 6} maxLength={s.max} defaultValue={content[s.id]} />
          </label>
        ))}
      </ActionForm>
      <ActionForm action={resetPrivacy} label="Reset to defaults" buttonClass="btn ghost" confirm="Throw away all your changes and go back to the standard wording (with its placeholders)?" />
    </>
  );
}
