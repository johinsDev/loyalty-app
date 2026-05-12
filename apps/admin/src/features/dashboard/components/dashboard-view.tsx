import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { trpc } from "@/lib/trpc/server";

import { HealthPingClient } from "./health-ping-client";

export async function DashboardView() {
  const t = await getTranslations("Dashboard");
  const api = await trpc();
  const ping = await api.health.ping();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("healthServer")}</CardTitle>
            <CardDescription>{t("healthServerDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-3 text-xs">{JSON.stringify(ping, null, 2)}</pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("healthClient")}</CardTitle>
            <CardDescription>{t("healthClientDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <HealthPingClient />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
