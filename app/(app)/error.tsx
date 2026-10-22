"use client";

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="card flex flex-col items-start gap-3">
      <h1 className="text-xl font-extrabold">Something went wrong</h1>
      <p className="text-muted">That page didn&apos;t load. Check your connection and try again.</p>
      <button className="btn" onClick={() => retry()}>Try again</button>
    </div>
  );
}
