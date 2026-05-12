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
import { getTranslations, setRequestLocale } from "next-intl/server";

import { isDevOnlyEnabled } from "@/lib/dev-only";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function WhatsAppOutboxDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  if (!isDevOnlyEnabled()) notFound();

  const t = await getTranslations("WhatsAppOutbox");
  const api = await trpc();
  const row = await api.whatsappOutbox.get({ id }).catch(() => null);
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
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
            {row.content}
          </pre>
          {row.mediaUrl ? (
            <p className="mt-3 text-xs">
              {t("media")}{" "}
              <a
                className="text-primary underline"
                href={row.mediaUrl}
                target="_blank"
                rel="noreferrer"
              >
                {row.mediaUrl}
              </a>
            </p>
          ) : null}
          {row.contentSid ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("contentSid")} <code>{row.contentSid}</code>
            </p>
          ) : null}
          {row.providerMessageId ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("providerMessageId")} <code>{row.providerMessageId}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {row.contentVariables ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("variables")}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(row.contentVariables, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
