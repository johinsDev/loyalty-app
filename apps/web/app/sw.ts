/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

/**
 * Push notification handlers. Wired alongside serwist (which owns
 * fetch / install / activate). Payloads come from `@loyalty/push`'s
 * `webpush` transport — it JSON-stringifies `{ title, body, data?,
 * badge?, icon?, image?, clickAction? }` and that's what we parse
 * here. See `.claude/skills/push/SKILL.md`.
 */

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  icon?: string;
  image?: string;
  clickAction?: string;
}

self.addEventListener("push", (event) => {
  let payload: PushPayload;
  try {
    payload = event.data?.json() ?? { title: "T4 Loyalty", body: "" };
  } catch {
    payload = { title: "T4 Loyalty", body: event.data?.text() ?? "" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? "/icons/icon.svg",
      ...(payload.badge !== undefined && { badge: String(payload.badge) }),
      ...(payload.image && { image: payload.image }),
      data: {
        ...(payload.clickAction && { clickAction: payload.clickAction }),
        ...payload.data,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as
    | { clickAction?: string }
    | undefined;
  const url = data?.clickAction ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            const focused = client.focus();
            const maybeNavigate = (client as WindowClient & {
              navigate?: (url: string) => Promise<WindowClient | null>;
            }).navigate;
            if (maybeNavigate) {
              return Promise.resolve(focused).then(() => maybeNavigate(url));
            }
            return focused;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
