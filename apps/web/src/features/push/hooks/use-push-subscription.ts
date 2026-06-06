"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  subscribeBrowserToPush,
  unsubscribeBrowserFromPush,
} from "@/lib/push-subscription";
import { useTRPC } from "@/lib/trpc/client";

export type PushSubscriptionStatus =
  | "idle"
  | "unsupported"
  | "granted"
  | "denied"
  | "error";

interface Args {
  vapidPublicKey: string | undefined;
  deviceLabel?: string;
}

/**
 * Thin wrapper around `subscribeBrowserToPush` + the
 * `pushTokens.register` mutation. Surface a single `subscribe()`
 * callback to your UI plus a status enum for rendering state.
 *
 * MUST be called from a user gesture (e.g. button click) — see
 * `subscribeBrowserToPush` for the browser-policy reasoning.
 */
export function usePushSubscription({ vapidPublicKey, deviceLabel }: Args) {
  const [status, setStatus] = useState<PushSubscriptionStatus>("idle");
  const trpc = useTRPC();
  const register = useMutation(trpc.pushTokens.register.mutationOptions());
  const revoke = useMutation(trpc.pushTokens.revoke.mutationOptions());

  const subscribe = useCallback(async () => {
    if (!vapidPublicKey) {
      setStatus("unsupported");
      return;
    }
    try {
      const sub = await subscribeBrowserToPush(vapidPublicKey);
      if (!sub) {
        const permission =
          typeof window !== "undefined" && "Notification" in window
            ? Notification.permission
            : "denied";
        setStatus(permission === "denied" ? "denied" : "unsupported");
        return;
      }
      await register.mutateAsync({
        platform: "webpush",
        token: JSON.stringify(sub),
        ...(deviceLabel && { deviceLabel }),
      });
      setStatus("granted");
    } catch {
      setStatus("error");
    }
  }, [vapidPublicKey, register, deviceLabel]);

  const unsubscribe = useCallback(async () => {
    try {
      const sub =
        typeof window !== "undefined" && "serviceWorker" in navigator
          ? await navigator.serviceWorker.ready.then((r) =>
              r.pushManager.getSubscription(),
            )
          : null;
      const token = sub ? JSON.stringify(sub.toJSON()) : null;
      await unsubscribeBrowserFromPush();
      if (token) {
        await revoke.mutateAsync({ token });
      }
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [revoke]);

  return {
    status,
    subscribe,
    unsubscribe,
    isPending: register.isPending || revoke.isPending,
  };
}
