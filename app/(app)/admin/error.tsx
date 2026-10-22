"use client";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card flex flex-col gap-2">
      <h1 className="text-xl font-extrabold">The admin page hit a problem</h1>
      <p className="text-sm text-muted">{error.message || "Something went wrong."}</p>
      <button className="btn" onClick={reset}>Try again</button>
    </div>
  );
}
