"use client";

/**
 * Sandboxed iframe with auto-resize for a persisted email body. The email
 * brings its own styles, so isolating it in an `<iframe srcdoc>` prevents
 * leakage in both directions. The `onLoad` handler measures the rendered
 * height and resizes the frame — which makes this a Client Component (event
 * handlers can't be passed from the server `OutboxDetail`).
 */
export function BodyIframe({ html }: { html: string }) {
  return (
    <iframe
      title="email-body"
      srcDoc={html}
      sandbox="allow-same-origin"
      className="w-full min-h-[500px] rounded-md border border-border bg-white"
      onLoad={(e) => {
        const frame = e.currentTarget;
        try {
          const doc = frame.contentDocument;
          if (doc) {
            frame.style.height = `${doc.body.scrollHeight + 32}px`;
          }
        } catch {
          // cross-origin safety — ignore.
        }
      }}
    />
  );
}
