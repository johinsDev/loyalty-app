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

import { BodyIframe } from "./body-iframe";

type Props = { id: string };

/**
 * Detail view for a persisted email. Renders the HTML body inside a
 * sandboxed `<iframe srcdoc>` so the email's own styles can't escape
 * into our app shell, and an inline script auto-resizes the iframe
 * to the rendered height.
 */
export async function OutboxDetail({ id }: Props) {
  const t = await getTranslations("EmailOutbox");
  const api = await trpc();
  const row = await api.emailOutbox.get({ id }).catch(() => null);
  if (!row) notFound();

  const metadata = row.metadata as Record<string, unknown> | null;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{t("detailTitle")}</h1>
        <p className="text-xs text-muted-foreground font-mono">{row.id}</p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{row.subject}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span>
              <span className="text-muted-foreground">{t("labelFrom")}</span>{" "}
              {row.from ?? <em className="text-muted-foreground">(not set)</em>}
            </span>
            <span>·</span>
            <span>
              <span className="text-muted-foreground">{t("labelTo")}</span>{" "}
              {row.to}
            </span>
            <span>·</span>
            <RelativeTime date={row.sentAt} />
            <Badge variant={row.status === "sent" ? "secondary" : "destructive"}>
              {row.status === "sent" ? t("statusSent") : t("statusFailed")}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {row.cc ? (
            <p className="mb-2 text-xs">
              <span className="text-muted-foreground">{t("labelCc")}</span>{" "}
              {row.cc}
            </p>
          ) : null}
          {row.bcc ? (
            <p className="mb-2 text-xs">
              <span className="text-muted-foreground">{t("labelBcc")}</span>{" "}
              {row.bcc}
            </p>
          ) : null}
          {row.replyTo ? (
            <p className="mb-2 text-xs">
              <span className="text-muted-foreground">{t("labelReplyTo")}</span>{" "}
              {row.replyTo}
            </p>
          ) : null}

          {row.html ? (
            <BodyIframe html={row.html} />
          ) : row.text ? (
            <pre className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap font-sans">
              {row.text}
            </pre>
          ) : (
            <em className="text-muted-foreground">{t("noBody")}</em>
          )}

          {row.providerMessageId ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("providerMessageId")} <code>{row.providerMessageId}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>

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
