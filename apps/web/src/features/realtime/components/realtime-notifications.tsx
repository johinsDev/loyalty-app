"use client";

import { useSession } from "@loyalty/auth/client";
import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Celebrate } from "@/lib/celebrate";
import { useTRPC } from "@/lib/trpc/client";

import { useCustomerRoom } from "../hooks/use-customer-room";

interface Props {
  /** PartyKit host from `NEXT_PUBLIC_PARTYKIT_HOST`. */
  host: string | undefined;
}

type Celebration = { title: string; body?: string };

/**
 * App-wide live notifications listener (mounted once in the locale layout).
 * Subscribes to the logged-in customer's room and, on a `notification` realtime
 * event, refreshes the in-app feed. A `first-purchase` event gets a celebratory
 * modal + confetti (a warmer welcome than a toast); everything else is a plain
 * informational toast.
 */
export function RealtimeNotifications({ host }: Props) {
  const t = useTranslations("Notifications");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const customerId = session?.user?.id ?? null;
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  useCustomerRoom({
    customerId,
    host,
    onEvent: (event) => {
      if (event.event !== "notification") return;
      const data = event.data as {
        type?: string;
        title?: string;
        body?: string;
      };
      void queryClient.invalidateQueries(trpc.notifications.pathFilter());

      if (data.type === "first-purchase") {
        setCelebration({
          title: data.title ?? t("firstPurchaseTitle"),
          body: data.body,
        });
        return;
      }
      toast(data.title ?? t("newNotification"), { description: data.body });
    },
  });

  return (
    <ResponsiveModal
      open={celebration !== null}
      onOpenChange={(open) => !open && setCelebration(null)}
    >
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-sm">
        {celebration ? (
          <>
            <div className="pointer-events-none fixed inset-0 z-50">
              <Celebrate distance={1000} />
            </div>
            <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-6 text-center">
              <span className="text-6xl">🎉</span>
              <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
                {celebration.title}
              </ResponsiveModalTitle>
              {celebration.body ? (
                <ResponsiveModalDescription className="text-muted-foreground text-sm">
                  {celebration.body}
                </ResponsiveModalDescription>
              ) : null}
              <Button
                onClick={() => setCelebration(null)}
                className="mt-3 h-12 w-full rounded-2xl font-semibold"
              >
                {t("firstPurchaseCta")}
              </Button>
            </div>
          </>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
