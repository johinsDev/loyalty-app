"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Root error boundary: catches errors thrown in the root layout itself.
// React swallows render errors into boundaries (they never hit window.onerror),
// so we forward them to Sentry by hand here. Renders outside the normal tree —
// it owns its own <html>/<body> and stays dependency-light (no next-intl /
// providers available at this level), so the copy is intentionally minimal and
// not run through the locale message files.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          Algo salió mal
        </h1>
        <p style={{ color: "#666", maxWidth: "28rem" }}>
          Ocurrió un error inesperado. Intenta de nuevo.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            borderRadius: "0.5rem",
            border: "1px solid #ccc",
            padding: "0.5rem 1rem",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
