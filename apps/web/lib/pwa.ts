/**
 * Helpers for PWA detection and the install prompt.
 * Browser-only — guard against SSR before calling.
 */

/**
 * Chrome/Edge fires `beforeinstallprompt` to give us a deferred prompt
 * we can fire later from a UI gesture. Capture it as soon as it fires.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

/** True when the app is running as an installed PWA (standalone display mode). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // Safari iOS exposes `navigator.standalone` instead.
  return (
    "standalone" in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Subscribe to `beforeinstallprompt` and receive the deferred event.
 * Returns an unsubscribe function.
 */
export function registerInstallPromptListener(
  onPrompt: (event: BeforeInstallPromptEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    event.preventDefault();
    onPrompt(event as BeforeInstallPromptEvent);
  };
  window.addEventListener("beforeinstallprompt", handler);
  return () => window.removeEventListener("beforeinstallprompt", handler);
}
