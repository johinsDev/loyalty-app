"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Switch,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

type Channel = "mail" | "sms" | "push" | "whatsapp";

/**
 * Per-channel marketing opt-out for the logged-in customer. Toggling a channel
 * off makes marketing-category notifications skip it; transactional / OTP
 * always send regardless. Backs the full demo loop: turn "marketing → email"
 * off here, re-send the promo from admin, and watch that channel report
 * `skipped / opted-out`.
 */
export function NotificationPreferences() {
  const t = useTranslations("Profile.notifications");
  const trpc = useTRPC();

  const prefs = useQuery(trpc.notifications.getMyPreferences.queryOptions());
  const setPreference = useMutation(
    trpc.notifications.setPreference.mutationOptions(),
  );

  // Local mirror so the switch reacts instantly; reconciled from the query.
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!prefs.data) return;
    setEnabled(
      Object.fromEntries(prefs.data.map((p) => [p.channel, p.marketingEnabled])),
    );
  }, [prefs.data]);

  const onToggle = async (channel: Channel, next: boolean) => {
    setEnabled((prev) => ({ ...prev, [channel]: next }));
    try {
      await setPreference.mutateAsync({ channel, marketingEnabled: next });
    } catch (err) {
      // Revert on failure.
      setEnabled((prev) => ({ ...prev, [channel]: !next }));
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    }
  };

  const channels: Channel[] = ["mail", "sms", "push", "whatsapp"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {channels.map((channel) => {
          const id = `pref-${channel}`;
          return (
            <div key={channel} className="flex items-center justify-between">
              <Label htmlFor={id} className="cursor-pointer">
                {t(`channel.${channel}`)}
              </Label>
              <Switch
                id={id}
                size="lg"
                checked={enabled[channel] ?? true}
                disabled={prefs.isLoading}
                onCheckedChange={(checked) => onToggle(channel, checked)}
              />
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">{t("transactionalNote")}</p>
      </CardContent>
    </Card>
  );
}
