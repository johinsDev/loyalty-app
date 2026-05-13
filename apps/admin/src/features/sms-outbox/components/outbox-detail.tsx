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
  const row = await api.smsOutbox.get({ id }).catch(() => null);
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Mensaje SMS</h1>
        <p className="text-xs text-muted-foreground">
          ID: <code>{row.id}</code>
        </p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{row.to}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            Enviado {row.sentAt.toISOString()}{" "}
            <Badge variant={row.status === "sent" ? "secondary" : "destructive"}>
              {row.status}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {row.encoding} · {row.segments} segmento(s) · {row.characters} chars
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
            {row.content}
          </pre>
          {row.providerMessageId ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Provider message ID: <code>{row.providerMessageId}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
