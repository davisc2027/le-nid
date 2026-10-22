"use client";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24, background: "#fff", color: "#1a1a1a" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Something went wrong</h1>
        <p>The app could not load. Check your connection and try again.</p>
        <button
          onClick={() => retry()}
          style={{ minHeight: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#e8892b", color: "#000", fontWeight: 700, fontSize: 16 }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
