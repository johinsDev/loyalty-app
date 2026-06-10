import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { env } from "@/env";
import { getSession } from "@/lib/auth-guard";
import { trpc } from "@/lib/trpc/server";

import { HealthPingClient } from "./health-ping-client";
import { StampEarnedListener } from "./stamp-earned-listener";

/**
 * Loyalty card screen body. Hits the health ping over RSC + ships a
 * client-side ping below to exercise both transports.
 *
 * Mounts `<StampEarnedListener />` so when the cashier adds a stamp
 * (via `api.sellos.add`) and that mutation publishes `stamp.earned`
 * into the customer's realtime room, the UI live-updates without a
 * reload. Graceful no-op when realtime isn't configured.
 */
export async function CardView() {
  const t = await getTranslations("Card");
  const api = await trpc();
  const ping = await api.health.ping();
  const session = await getSession();
  const customerId = session?.user?.id ?? null;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-3 text-xs">{JSON.stringify(ping, null, 2)}</pre>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("healthClient")}</CardTitle>
        </CardHeader>
        <CardContent>
          <HealthPingClient />
        </CardContent>
      </Card>
      {customerId ? (
        <StampEarnedListener
          customerId={customerId}
          partykitHost={env.NEXT_PUBLIC_PARTYKIT_HOST}
        />
      ) : null}
    </main>
  );
}
