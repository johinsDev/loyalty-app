"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

export const HealthPingClient = () => {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(trpc.health.ping.queryOptions());

  if (isLoading) return <p className="text-xs text-muted-foreground">Cargando…</p>;
  if (error) return <p className="text-xs text-red-600">{error.message}</p>;

  return <pre className="rounded-md bg-muted p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>;
};
