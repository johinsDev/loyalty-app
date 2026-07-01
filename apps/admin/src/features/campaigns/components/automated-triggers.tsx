"use client";

import { Badge, Button, Input, Switch } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

const CONFIG_CHANNELS = ["push", "mail", "sms", "whatsapp", "database"] as const;

/**
 * Automated-trigger config — the umbrella's "Automatizadas" surface. Each keyed
 * notification can be toggled on/off and restricted to a channel subset (the
 * send job consults `notification_config`). Protected/security triggers are
 * always-on and read-only.
 */
export function AutomatedTriggers() {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(trpc.notifications.configList.queryOptions());
  const setConfig = useMutation(trpc.notifications.setConfig.mutationOptions());
  const [search, setSearch] = useState("");

  const save = (
    key: string,
    enabled: boolean,
    channels: string[] | null,
  ) => {
    setConfig.mutate(
      { notificationKey: key as never, enabled, channels: channels as never },
      {
        onSuccess: () =>
          queryClient.invalidateQueries(trpc.notifications.configList.queryFilter()),
        onError: () => toast.error(t("saveError")),
      },
    );
  };

  const q = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter(
    (row) => !q || t(`triggers.${row.notificationKey}`).toLowerCase().includes(q),
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Link
        href="/campaigns"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("automatedTitle")}
      </h1>
      <p className="text-muted-foreground text-sm">{t("automatedSubtitle")}</p>

      <div className="relative mt-6 max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("automatedSearchPlaceholder")}
          className="h-10 pl-9"
        />
      </div>

      <div className="mt-4 max-w-3xl space-y-2.5">
        {query.data && rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {t("automatedNoResults")}
          </p>
        ) : null}
        {rows.map((row) => {
          // null channels behave as "all declared"; show all checked.
          const active = new Set(row.channels ?? CONFIG_CHANNELS);
          const toggleChannel = (ch: string) => {
            const next = new Set(active);
            if (next.has(ch)) next.delete(ch);
            else next.add(ch);
            if (next.size === 0) return; // keep at least one
            save(row.notificationKey, row.enabled, [...next]);
          };
          return (
            <section
              key={row.notificationKey}
              className="bg-card border-border rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {t(`triggers.${row.notificationKey}`)}
                  </p>
                  {row.isProtected ? (
                    <Badge variant="secondary" className="mt-1">
                      {t("triggerAlwaysOn")}
                    </Badge>
                  ) : null}
                </div>
                {row.isProtected ? (
                  <Switch checked disabled />
                ) : (
                  <Switch
                    checked={row.enabled}
                    onCheckedChange={(v) =>
                      save(row.notificationKey, v, row.channels)
                    }
                  />
                )}
              </div>

              {!row.isProtected && row.enabled ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {CONFIG_CHANNELS.map((ch) => (
                    <Button
                      key={ch}
                      type="button"
                      size="sm"
                      variant={active.has(ch) ? "default" : "outline"}
                      className="h-8 rounded-full"
                      onClick={() => toggleChannel(ch)}
                    >
                      {t(`cfgChannel.${ch}`)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
