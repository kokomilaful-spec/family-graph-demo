"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ background: "#1a3040", color: "#f5efe6", padding: 40, fontFamily: "monospace" }}>
        <h2>Client Error Caught</h2>
        <pre style={{ color: "#e05858", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {error.message}
        </pre>
        <pre style={{ color: "#a1a1aa", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {error.stack}
        </pre>
        <button onClick={reset} style={{ marginTop: 20, padding: "8px 16px", background: "#2d7e8a", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
