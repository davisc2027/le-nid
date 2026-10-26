import { CREDIT_LABEL, type Credit as CreditId } from "./data";

/** The attribution line third-party data requires, e.g. "Data provided by Joshua Project" as a link. */
export default function Credit({ credit }: { credit: CreditId }) {
  const c = CREDIT_LABEL[credit];
  return (
    <p className="text-xs text-muted">
      <a href={c.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">{c.text}</a>
    </p>
  );
}
