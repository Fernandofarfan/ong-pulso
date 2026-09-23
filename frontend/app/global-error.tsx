"use client";

export function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f1418",
          color: "#dee3e9",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 480, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#bec8d2", marginBottom: 16 }}>
            {error.message || "Unexpected application error."}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#89ceff",
              color: "#00344d",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
