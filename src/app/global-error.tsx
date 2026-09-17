"use client";

import { useEffect } from "react";

/**
 * Root error boundary (§66). Catches failures in the root layout / outside the
 * (app) group, which the per-group boundary cannot. It renders its own <html>/<body>
 * because it replaces the whole document, and never exposes a stack trace.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[global] fatal render error", error); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#faf9f7", color: "#1c1a17" }}>
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Something went wrong{/* i18n-ignore pre-provider crash boundary */}</h1>
          <p style={{ marginTop: 8, maxWidth: 380, fontSize: 13, color: "#5c574f" }}>
            An unexpected error interrupted the app. Please retry; if it persists, contact an administrator.
          </p>
          {error.digest && <p style={{ marginTop: 8, fontFamily: "monospace", fontSize: 11, color: "#8a8378" }}>Reference: {error.digest}</p>}
          <button onClick={() => reset()} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: 0, background: "#6d4d6b", color: "#fff", fontSize: 14, cursor: "pointer" }}>
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
