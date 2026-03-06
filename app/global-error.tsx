"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body style={{ backgroundColor: "#0a0f1a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "0.5rem" }}>{error.message}</p>
          <button onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem", backgroundColor: "#2563eb", borderRadius: "0.5rem", border: "none", color: "white", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
