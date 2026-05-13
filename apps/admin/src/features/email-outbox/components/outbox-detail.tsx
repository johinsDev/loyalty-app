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

type Props = { id: string };

export async function OutboxDetail({ id }: Props) {
  const api = await trpc();
  const row = await api.emailOutbox.get({ id }).catch(() => null);
  if (!row) notFound();

  const metadata = row.metadata as Record<string, unknown> | null;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Email</h1>
        <p className="text-xs text-muted-foreground">
          ID: <code>{row.id}</code>
        </p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{row.subject}</CardTitle>
          <CardDescription className="text-xs flex flex-wrap gap-2">
            <span>De: {row.from ?? "(no set)"}</span>
            <span>·</span>
            <span>Para: {row.to}</span>
            <span>·</span>
            <span>Enviado {row.sentAt.toISOString()}</span>
            <Badge variant={row.status === "sent" ? "secondary" : "destructive"}>
              {row.status}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {row.cc ? (
            <p className="mb-1 text-xs">
              <span className="text-muted-foreground">Cc:</span> {row.cc}
            </p>
          ) : null}
          {row.bcc ? (
            <p className="mb-1 text-xs">
              <span className="text-muted-foreground">Cco:</span> {row.bcc}
            </p>
          ) : null}
          {row.replyTo ? (
            <p className="mb-2 text-xs">
              <span className="text-muted-foreground">Responder a:</span>{" "}
              {row.replyTo}
            </p>
          ) : null}

          {row.html ? (
            <iframe
              title="email-body"
              srcDoc={row.html}
              sandbox="allow-same-origin"
              className="w-full min-h-[500px] rounded-md border border-border bg-white"
            />
          ) : row.text ? (
            <pre className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap font-sans">
              {row.text}
            </pre>
          ) : (
            <em className="text-muted-foreground text-sm">(sin cuerpo)</em>
          )}

          {row.providerMessageId ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Provider message ID: <code>{row.providerMessageId}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {metadata ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
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
