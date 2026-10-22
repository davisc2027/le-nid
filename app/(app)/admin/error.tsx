"use client";

export default function AdminError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="card flex flex-col items-start gap-2">
      <h1 className="text-xl font-extrabold">The admin page hit a problem</h1>
      <p className="text-sm text-muted">It did not load. Check your connection and try again.</p>
      <button className="btn" onClick={() => retry()}>Try again</button>
    </div>
  );
}
