"use client";

import { useSession } from "@loyalty/auth/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import { useCustomerRoom } from "../hooks/use-customer-room";

interface Props {
  /** PartyKit host from `NEXT_PUBLIC_PARTYKIT_HOST`. */
  host: string | undefined;
}

/**
 * App-wide live notifications listener. Mounted once in the locale layout, it
 * subscribes to the logged-in customer's own room (`customer:<id>`) and, on a
 * `notification` realtime event, shows a toast and refreshes the in-app feed
 * queries so the badge/list update without a reload. Renders nothing; reads
 * the current user from the auth client so it works on every page.
 */
export function RealtimeNotifications({ host }: Props) {
  const t = useTranslations("Notifications");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const customerId = session?.user?.id ?? null;

  useCustomerRoom({
    customerId,
    host,
    onEvent: (event) => {
      if (event.event !== "notification") return;
      const data = event.data as { title?: string; body?: string };
      toast(data.title ?? t("newNotification"), {
        description: data.body,
      });
      void queryClient.invalidateQueries(trpc.notifications.pathFilter());
    },
  });

  return null;
}
