/** Collapsible card so the admin page stays short. */
export default function Section({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="card" open={open}>
      <summary className="min-h-11 cursor-pointer font-bold">{title}</summary>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </details>
  );
}
