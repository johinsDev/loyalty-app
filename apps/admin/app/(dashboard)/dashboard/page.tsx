import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";

import { trpc } from "@/lib/trpc/server";

import { HealthPingClient } from "./health-ping-client";

export default async function DashboardPage() {
  const api = await trpc();
  const ping = await api.health.ping();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Health (server)</CardTitle>
            <CardDescription>tRPC desde RSC</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-3 text-xs">{JSON.stringify(ping, null, 2)}</pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Health (client)</CardTitle>
            <CardDescription>tRPC + React Query desde el cliente</CardDescription>
          </CardHeader>
          <CardContent>
            <HealthPingClient />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
