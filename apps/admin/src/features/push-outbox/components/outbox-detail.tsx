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

/**
 * Detail view for a persisted push notification. No HTML body — push
 * payloads are short text + an optional `data` JSON for deep linking;
 * we render both as a structured card plus the raw metadata.
 */
export async function OutboxDetail({ id }: Props) {
  const t = await getTranslations("PushOutbox");
  const api = await trpc();
  const row = await api.pushOutbox.get({ id }).catch(() => null);
  if (!row) notFound();

  const metadata = row.metadata as Record<string, unknown> | null;
  const data = row.data as Record<string, unknown> | null;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{t("detailTitle")}</h1>
        <p className="text-xs text-muted-foreground font-mono">{row.id}</p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{row.title}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant={row.platform === "expo" ? "secondary" : "outline"}
            >
              {row.platform === "expo"
                ? t("platformExpo")
                : t("platformWebpush")}
            </Badge>
            <Badge variant={row.status === "sent" ? "secondary" : "destructive"}>
              {row.status === "sent" ? t("statusSent") : t("statusFailed")}
            </Badge>
            <RelativeTime date={row.sentAt} />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{row.body}</p>

          <details className="rounded-md bg-muted p-3 text-xs">
            <summary className="cursor-pointer font-medium">
              {t("tokenLabel")}
            </summary>
            <pre className="mt-2 break-all whitespace-pre-wrap font-mono">
              {row.deviceToken}
            </pre>
          </details>

          {row.providerMessageId ? (
            <p className="text-xs text-muted-foreground">
              {t("providerMessageId")} <code>{row.providerMessageId}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {data ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">{t("dataTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {metadata ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("metadataTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
