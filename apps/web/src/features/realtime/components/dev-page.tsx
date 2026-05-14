"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@loyalty/ui";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { useCustomerRoom } from "../hooks/use-customer-room";

import { ConnectionBadge } from "./connection-badge";

interface Props {
  /** Authenticated session user id — doubles as the customer id in v1. `null` when signed out. */
  selfId: string | null;
  partykitHost: string | undefined;
}

/**
 * Smoke-test surface for the realtime channel. Connects to the
 * caller's own customer room, lists every event received, and lets
 * you publish a `dev.hello` event into the same room via the
 * `realtime.publishHello` mutation so you can watch the round-trip
 * in one screen.
 *
 * Gated by the `(dev)` layout (returns 404 in production). The
 * mutation itself also rejects in production for defence in depth.
 */
export function RealtimeDevPage({ selfId, partykitHost }: Props) {
  const t = useTranslations("Realtime");
  const [log, setLog] = useState<Array<{ ts: string; json: string }>>([]);
  const [message, setMessage] = useState("hello");
  const trpc = useTRPC();
  const publishHello = useMutation(trpc.realtime.publishHello.mutationOptions());

  const { status } = useCustomerRoom({
    customerId: selfId,
    host: partykitHost,
    onEvent: (event) => {
      setLog((prev) =>
        [
          { ts: new Date().toISOString(), json: JSON.stringify(event, null, 2) },
          ...prev,
        ].slice(0, 25),
      );
    },
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <ConnectionBadge status={status} />
      </header>

      {!partykitHost ? (
        <Card className="mb-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/40">
          <CardHeader>
            <CardTitle>{t("notConfiguredTitle")}</CardTitle>
            <CardDescription>{t("notConfiguredDescription")}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!selfId ? (
        <Card className="mb-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/40">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              The realtime channel mints tickets per signed-in user. Sign in (or open /sign-in) to test the round-trip.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t("sendTitle")}</CardTitle>
          <CardDescription>{t("sendDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("messagePlaceholder")}
            className="sm:max-w-xs"
            maxLength={280}
          />
          <Button
            onClick={() =>
              selfId &&
              publishHello.mutate({
                roomId: `customer:${selfId}`,
                message,
              })
            }
            disabled={publishHello.isPending || !partykitHost || !selfId}
          >
            {publishHello.isPending ? t("sending") : t("sendButton")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("eventsTitle")}</CardTitle>
          <CardDescription>{t("eventsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyLog")}</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {log.map((entry, idx) => (
                <li
                  key={`${entry.ts}-${idx}`}
                  className="rounded-md border bg-muted p-2"
                >
                  <p className="mb-1 text-muted-foreground">{entry.ts}</p>
                  <pre className="whitespace-pre-wrap break-all">
                    {entry.json}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
