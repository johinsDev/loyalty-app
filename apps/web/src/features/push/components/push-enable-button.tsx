"use client";

import { Button } from "@loyalty/ui/components/ui/button";

import {
  usePushSubscription,
  type PushSubscriptionStatus,
} from "../hooks/use-push-subscription";

interface Props {
  vapidPublicKey: string | undefined;
  labels?: Partial<Record<PushSubscriptionStatus | "subscribe", string>>;
}

/**
 * Drop-in "turn on notifications" button. Pass the public VAPID key
 * from `env.NEXT_PUBLIC_VAPID_PUBLIC_KEY` and you're done — the token's
 * owner (customer + org) is resolved server-side from the session by
 * the `pushTokens.register` mutation.
 */
export function PushEnableButton({ vapidPublicKey, labels }: Props) {
  const { status, subscribe, isPending } = usePushSubscription({
    vapidPublicKey,
  });

  if (status === "granted") {
    return (
      <span className="text-sm text-muted-foreground">
        {labels?.granted ?? "Notificaciones activadas"}
      </span>
    );
  }
  if (status === "denied") {
    return (
      <span className="text-sm text-muted-foreground">
        {labels?.denied ?? "Permitilo desde la configuración del navegador"}
      </span>
    );
  }
  if (status === "unsupported") {
    return (
      <span className="text-sm text-muted-foreground">
        {labels?.unsupported ?? "Tu navegador no soporta notificaciones"}
      </span>
    );
  }

  return (
    <Button onClick={subscribe} disabled={isPending}>
      {labels?.subscribe ?? "Activar notificaciones"}
    </Button>
  );
}
