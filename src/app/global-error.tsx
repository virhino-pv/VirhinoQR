"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1>VirhinoQR could not load</h1>
        <p>Please reload the page.</p>
        <button type="button" onClick={reset} style={{ padding: "0.6rem 1.2rem", marginTop: "1rem" }}>
          Reload
        </button>
      </body>
    </html>
  );
}
