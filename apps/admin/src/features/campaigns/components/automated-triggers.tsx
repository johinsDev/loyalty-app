"use client";

import {
  Badge,
  Button,
  cn,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  Switch,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Lock, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

const CONFIG_CHANNELS = ["push", "mail", "sms", "whatsapp", "database"] as const;

/**
 * Automated-trigger config — the umbrella's "Automatizadas" surface. Each keyed
 * notification is an event-driven message the customer gets automatically; the
 * admin can turn it on/off and pick which channels carry it (the send job
 * consults `notification_config`). Protected/security triggers are always-on.
 */
export function AutomatedTriggers() {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(trpc.notifications.configList.queryOptions());
  const setConfig = useMutation(trpc.notifications.setConfig.mutationOptions());
  const [search, setSearch] = useState("");
  const [confirmOff, setConfirmOff] = useState<{
    key: string;
    name: string;
    channels: string[] | null;
  } | null>(null);

  const save = (key: string, enabled: boolean, channels: string[] | null) => {
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
    <div className="mx-auto w-full max-w-2xl px-5 py-6 lg:px-8">
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

      <div className="relative mt-6">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("automatedSearchPlaceholder")}
          className="h-10 pl-9"
        />
      </div>

      <div className="mt-4 space-y-2.5">
        {query.data && rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {t("automatedNoResults")}
          </p>
        ) : null}
        {rows.map((row) => {
          const name = t(`triggers.${row.notificationKey}`);
          // null channels behave as "all declared"; show all as on.
          const active = new Set(row.channels ?? CONFIG_CHANNELS);
          const toggleChannel = (ch: string) => {
            if (ch === "database") return; // Inbox is a permanent record — locked on.
            const next = new Set(active);
            if (next.has(ch)) next.delete(ch);
            else next.add(ch);
            next.add("database"); // always keep the Inbox record
            if (next.size === 0) return; // keep at least one
            save(row.notificationKey, row.enabled, [...next]);
          };
          return (
            <section
              key={row.notificationKey}
              className="bg-card border-border rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{name}</p>
                    {row.isProtected ? (
                      <Badge variant="secondary">{t("triggerAlwaysOn")}</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t(`triggerDesc.${row.notificationKey}`)}
                  </p>
                </div>
                {row.isProtected ? (
                  <Switch checked disabled className="mt-0.5 shrink-0" />
                ) : (
                  <Switch
                    checked={row.enabled}
                    className="mt-0.5 shrink-0"
                    onCheckedChange={(v) => {
                      if (v) save(row.notificationKey, true, row.channels);
                      else
                        setConfirmOff({
                          key: row.notificationKey,
                          name,
                          channels: row.channels,
                        });
                    }}
                  />
                )}
              </div>

              {!row.isProtected && row.enabled ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-muted-foreground mb-2 text-xs font-semibold">
                    {t("automatedChannelsLabel")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CONFIG_CHANNELS.map((ch) => {
                      const locked = ch === "database"; // Inbox = permanent record
                      const on = locked || active.has(ch);
                      return (
                        <button
                          key={ch}
                          type="button"
                          disabled={locked}
                          onClick={() => toggleChannel(ch)}
                          title={locked ? t("automatedInboxLocked") : undefined}
                          className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors",
                            on
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted",
                            locked && "cursor-default opacity-90",
                          )}
                        >
                          {on ? <Check className="size-3" /> : null}
                          {t(`cfgChannel.${ch}`)}
                          {locked ? <Lock className="size-2.5" /> : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-muted-foreground/70 mt-2 text-[11px]">
                    {t("automatedChannelsHint")}
                  </p>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <ResponsiveModal open={confirmOff !== null} onOpenChange={(o) => !o && setConfirmOff(null)}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {confirmOff ? t("automatedOffTitle", { name: confirmOff.name }) : ""}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">{t("automatedOffBody")}</p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setConfirmOff(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
              onClick={() => {
                if (confirmOff) save(confirmOff.key, false, confirmOff.channels);
                setConfirmOff(null);
              }}
            >
              {t("automatedOffConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
