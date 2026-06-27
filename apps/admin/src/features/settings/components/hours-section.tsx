"use client";

import {
  AddressField,
  createGooglePlacesProvider,
  type StoreAddress,
  StoreAddressPreview,
  Switch,
  TimeInput,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useAddressLabels } from "@/components/use-address-labels";
import { env } from "@/env";
import { useTRPC } from "@/lib/trpc/client";

import { type DayHours, DAYS, hours } from "../data";

/**
 * Opening hours + store location. Hours are design-first (local state; seam is
 * a future `settings.hours` mutation). The location block edits the **primary
 * store** directly via `stores.update` — the store model is the single source
 * of truth for a branch's address (structured + map screenshot).
 */
export function HoursSection() {
  const t = useTranslations("Settings");
  const [days, setDays] = useState<DayHours[]>(hours);

  const update = (day: string, patch: Partial<DayHours>) =>
    setDays((prev) => prev.map((d) => (d.day === day ? { ...d, ...patch } : d)));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{t("hours.title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("hours.desc")}</p>
      </div>

      <div className="space-y-2">
        {DAYS.map((dayKey) => {
          const d = days.find((x) => x.day === dayKey)!;
          return (
            <div
              key={dayKey}
              className="border-border flex items-center gap-3 rounded-2xl border p-3"
            >
              <Switch
                checked={!d.closed}
                onCheckedChange={(open) => update(dayKey, { closed: !open })}
              />
              <span className="w-20 flex-none text-sm font-semibold">
                {t(`hours.day.${dayKey}`)}
              </span>
              {d.closed ? (
                <span className="text-muted-foreground text-sm font-semibold">
                  {t("hours.closed")}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <TimeInput
                    value={d.open}
                    onChange={(open) => update(dayKey, { open })}
                    disabled={d.closed}
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <TimeInput
                    value={d.close}
                    onChange={(close) => update(dayKey, { close })}
                    disabled={d.closed}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-border space-y-4 border-t pt-4">
        <h3 className="font-display text-base font-semibold tracking-tight">
          {t("hours.locationTitle")}
        </h3>
        <PrimaryStoreLocation />
      </div>
    </section>
  );
}

/** Edits the primary store's structured address inline. */
function PrimaryStoreLocation() {
  const t = useTranslations("Settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const addressLabels = useAddressLabels();

  const provider = useMemo(() => {
    const key = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    return key ? createGooglePlacesProvider({ apiKey: key }) : undefined;
  }, []);

  const { data: stores } = useQuery(trpc.stores.list.queryOptions());
  const store = stores?.find((s) => s.isPrimary) ?? stores?.[0];
  const update = useMutation(trpc.stores.update.mutationOptions());

  if (!store) {
    return <p className="text-muted-foreground text-sm">{t("hours.noStore")}</p>;
  }

  const value: StoreAddress | null =
    store.addressParts ??
    (store.address
      ? {
          line1: store.address,
          ...(store.lat != null ? { lat: store.lat } : {}),
          ...(store.lng != null ? { lng: store.lng } : {}),
          ...(store.placeId ? { placeId: store.placeId } : {}),
          formatted: store.address,
        }
      : null);

  const onChange = (address: StoreAddress | null) => {
    update.mutate(
      { id: store.id, address },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries(trpc.stores.list.queryFilter());
          toast.success(t("hours.locationSaved"));
        },
        onError: () => toast.error(t("hours.locationError")),
      },
    );
  };

  return (
    <div className="space-y-4">
      <AddressField
        value={value}
        onChange={onChange}
        {...(provider ? { provider } : {})}
        {...(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          ? { mapsApiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY }
          : {})}
        labels={addressLabels}
      />
      {value ? (
        <StoreAddressPreview
          address={value}
          name={store.name}
          mapStaticUrl={store.mapStaticUrl}
          labels={{ title: t("hours.previewTitle"), empty: t("hours.previewEmpty") }}
        />
      ) : null}
    </div>
  );
}
