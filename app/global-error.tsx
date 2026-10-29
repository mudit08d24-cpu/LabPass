"use client";

// Last resort when the root layout itself fails: plain HTML, no app styles.

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f1e43c", fontFamily: "system-ui, sans-serif", color: "#151515" }}>
        <div style={{ background: "#fbfaf3", border: "2px solid #151515", borderRadius: 20, padding: 28, maxWidth: 380, textAlign: "center", boxShadow: "6px 6px 0 #151515" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>LabPass couldn&apos;t load</h1>
          <p style={{ fontSize: 14 }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ background: "#151515", color: "#fbfaf3", border: 0, borderRadius: 999, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
