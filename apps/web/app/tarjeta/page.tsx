import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";

import { trpc } from "@/lib/trpc/server";

import { HealthPingClient } from "./health-ping-client";

export default async function TarjetaPage() {
  const api = await trpc();
  const ping = await api.health.ping();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Mi tarjeta</CardTitle>
          <CardDescription>Sellos acumulados (placeholder)</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-3 text-xs">{JSON.stringify(ping, null, 2)}</pre>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Health (client)</CardTitle>
        </CardHeader>
        <CardContent>
          <HealthPingClient />
        </CardContent>
      </Card>
    </main>
  );
}
