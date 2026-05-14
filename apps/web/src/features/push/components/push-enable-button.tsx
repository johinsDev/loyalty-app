"use client";

import { Button } from "@loyalty/ui/components/ui/button";

import {
  usePushSubscription,
  type PushSubscriptionStatus,
} from "../hooks/use-push-subscription";

interface Props {
  customerId: string;
  organizationId: string;
  vapidPublicKey: string | undefined;
  labels?: Partial<Record<PushSubscriptionStatus | "subscribe", string>>;
}

/**
 * Drop-in "turn on notifications" button. Pass in `customerId` +
 * `organizationId` (the caller knows them from the loyalty-card
 * context) plus the public VAPID key from
 * `env.NEXT_PUBLIC_VAPID_PUBLIC_KEY` and you're done.
 *
 * Not mounted anywhere in v1 — the placement is a product-UX decision
 * (where in the onboarding flow does the prompt go) deferred until
 * after the package lands.
 */
export function PushEnableButton({
  customerId,
  organizationId,
  vapidPublicKey,
  labels,
}: Props) {
  const { status, subscribe, isPending } = usePushSubscription({
    customerId,
    organizationId,
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
