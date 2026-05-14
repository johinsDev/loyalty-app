/**
 * Browser helper: ask the user for notification permission, subscribe
 * the service worker to the Web Push protocol with our VAPID public
 * key, and return the resulting `PushSubscription` as plain JSON ready
 * to POST to `api.pushTokens.register`.
 *
 * Returns `null` when:
 *   - the browser lacks Service Worker or Push API support
 *   - the user denied or dismissed the permission prompt
 *
 * MUST be called from a user gesture (button click) — `requestPermission`
 * is gated by browser policy and silently fails otherwise.
 */

export interface BrowserPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export async function subscribeBrowserToPush(
  publicKey: string,
): Promise<BrowserPushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  if (!("PushManager" in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return null;
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    expirationTime: json.expirationTime,
  };
}

/**
 * Inverse of `subscribeBrowserToPush` — call this before
 * `pushTokens.revoke` so the browser side stops receiving pushes
 * regardless of what the server does.
 */
export async function unsubscribeBrowserFromPush(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return false;
  return subscription.unsubscribe();
}
