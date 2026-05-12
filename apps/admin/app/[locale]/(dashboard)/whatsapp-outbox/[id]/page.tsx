import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@loyalty/ui";
import { notFound } from "next/navigation";

import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function WhatsAppOutboxDetailPage({ params }: Props) {
  const { id } = await params;
  const api = await trpc();
  const row = await api.whatsappOutbox.get({ id }).catch(() => null);
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Mensaje</h1>
        <p className="text-xs text-muted-foreground">
          ID: <code>{row.id}</code>
        </p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{row.to}</CardTitle>
          <CardDescription>
            Enviado {row.sentAt.toISOString()}{" "}
            <Badge variant={row.status === "sent" ? "secondary" : "destructive"}>
              {row.status}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
            {row.content}
          </pre>
          {row.mediaUrl ? (
            <p className="mt-3 text-xs">
              Media:{" "}
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
              Content SID: <code>{row.contentSid}</code>
            </p>
          ) : null}
          {row.providerMessageId ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Provider message ID: <code>{row.providerMessageId}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {row.contentVariables ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variables</CardTitle>
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
