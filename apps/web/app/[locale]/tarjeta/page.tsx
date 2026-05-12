import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { trpc } from "@/lib/trpc/server";

import { HealthPingClient } from "./health-ping-client";

type Props = { params: Promise<{ locale: string }> };

export default async function TarjetaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Card");
  const api = await trpc();
  const ping = await api.health.ping();

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
    </main>
  );
}
