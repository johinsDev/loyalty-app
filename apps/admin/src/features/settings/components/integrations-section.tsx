"use client";

import { Badge, Button } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { type Integration, integrations } from "../data";

/**
 * Integrations section: connect / disconnect third-party channels. Design-first —
 * state is local, actions toast. Seam: per-org integration credentials + the
 * WhatsApp / Resend / PostHog providers.
 */
export function IntegrationsSection() {
  const t = useTranslations("Settings");
  const [items, setItems] = useState<Integration[]>(integrations);

  const toggle = (id: string) =>
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const next = !i.connected;
        toast.success(
          next ? t("integrations.connect") : t("integrations.disconnect"),
        );
        return { ...i, connected: next };
      }),
    );

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("integrations.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("integrations.desc")}
        </p>
      </div>

      <div className="space-y-3">
        {items.map((i) => (
          <div
            key={i.id}
            className="border-border flex items-center gap-3 rounded-2xl border p-4"
          >
            <span className="bg-muted grid size-11 place-items-center rounded-xl text-2xl">
              {i.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">
                {t(`integrations.int.${i.id}.name`)}
              </div>
              <p className="text-muted-foreground truncate text-sm">
                {t(`integrations.int.${i.id}.desc`)}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                i.connected ? "text-emerald-600" : "text-muted-foreground"
              }
            >
              {i.connected
                ? t("integrations.connected")
                : t("integrations.notConnected")}
            </Badge>
            <Button
              variant={i.connected ? "outline" : "default"}
              onClick={() => toggle(i.id)}
              className="h-10 rounded-xl"
            >
              {i.connected
                ? t("integrations.disconnect")
                : t("integrations.connect")}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
