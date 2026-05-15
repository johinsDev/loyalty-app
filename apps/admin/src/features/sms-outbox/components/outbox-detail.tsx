import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@loyalty/ui";
import { RelativeTime } from "@loyalty/date/react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { trpc } from "@/lib/trpc/server";

type Props = { id: string };

export async function OutboxDetail({ id }: Props) {
  const t = await getTranslations("SmsOutbox");
  const api = await trpc();
  const row = await api.smsOutbox.get({ id }).catch(() => null);
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{t("detailTitle")}</h1>
        <p className="text-xs text-muted-foreground font-mono">{row.id}</p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-mono text-base">{row.to}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <RelativeTime date={row.sentAt} />
            <Badge variant={row.status === "sent" ? "secondary" : "destructive"}>
              {row.status === "sent" ? t("statusSent") : t("statusFailed")}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {row.encoding} · {row.segments}{" "}
              {row.segments === 1 ? t("segment") : t("segments")} · {row.characters}{" "}
              {t("chars")}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
            {row.content}
          </pre>
          {row.providerMessageId ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("providerMessageId")} <code>{row.providerMessageId}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
