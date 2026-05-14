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
  const row = await api.pushOutbox.get({ id }).catch(() => null);
  if (!row) notFound();

  const metadata = row.metadata as Record<string, unknown> | null;
  const data = row.data as Record<string, unknown> | null;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Notificación</h1>
        <p className="text-xs text-muted-foreground">
          ID: <code>{row.id}</code>
        </p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{row.title}</CardTitle>
          <CardDescription className="text-xs flex flex-wrap gap-2 items-center">
            <Badge variant={row.platform === "expo" ? "secondary" : "outline"}>
              {row.platform}
            </Badge>
            <Badge variant={row.status === "sent" ? "secondary" : "destructive"}>
              {row.status}
            </Badge>
            <span>Enviado {row.sentAt.toISOString()}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{row.body}</p>

          <details className="rounded-md bg-muted p-3 text-xs">
            <summary className="cursor-pointer font-medium">
              Token completo
            </summary>
            <pre className="mt-2 break-all whitespace-pre-wrap font-mono">
              {row.deviceToken}
            </pre>
          </details>

          {row.providerMessageId ? (
            <p className="text-xs text-muted-foreground">
              Provider message ID: <code>{row.providerMessageId}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {data ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Data payload</CardTitle>
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
