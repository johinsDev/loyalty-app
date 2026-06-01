"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

type NotificationKey = "new-user" | "promo";

/**
 * Pick a notification type + a set of customers, then enqueue the send.
 * Selection is local state; the send mutation hands off to a Trigger.dev run
 * that fans out per customer and respects each one's marketing opt-out.
 */
export function SendForm() {
  const t = useTranslations("Notifications");
  const trpc = useTRPC();

  const [notificationKey, setNotificationKey] =
    useState<NotificationKey>("new-user");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const customers = useQuery(
    trpc.notifications.listCustomers.queryOptions({ limit: 200 }),
  );
  const send = useMutation(trpc.notifications.send.mutationOptions());

  const rows = useMemo(() => {
    const all = customers.data ?? [];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [customers.data, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSend = async () => {
    const customerIds = [...selected];
    if (customerIds.length === 0) {
      toast.error(t("noneSelected"));
      return;
    }
    try {
      const result = await send.mutateAsync({ customerIds, notificationKey });
      toast.success(t("enqueued", { count: result.enqueued }));
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sendFailed"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sendTitle")}</CardTitle>
        <CardDescription>{t("sendDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="notification-type">{t("typeLabel")}</Label>
          <NativeSelect
            id="notification-type"
            value={notificationKey}
            onChange={(e) =>
              setNotificationKey(e.target.value as NotificationKey)
            }
          >
            <NativeSelectOption value="new-user">
              {t("typeNewUser")}
            </NativeSelectOption>
            <NativeSelectOption value="promo">
              {t("typePromo")}
            </NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-search">{t("recipientsLabel")}</Label>
          <Input
            id="customer-search"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {customers.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">{t("loading")}</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("noCustomers")}</p>
          ) : (
            rows.map((c) => {
              const checkboxId = `customer-${c.id}`;
              return (
                <label
                  key={c.id}
                  htmlFor={checkboxId}
                  className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {c.name ?? t("unnamedCustomer")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.phone}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t("selectedCount", { count: selected.size })}
          </span>
          <Button
            type="button"
            onClick={onSend}
            disabled={send.isPending || selected.size === 0}
            aria-busy={send.isPending}
          >
            <SendIcon className="size-4" aria-hidden />
            {send.isPending ? t("sending") : t("sendButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
