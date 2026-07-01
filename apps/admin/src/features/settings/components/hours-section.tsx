"use client";

import {
  AddressField,
  Button,
  createGooglePlacesProvider,
  InputPhone,
  Label,
  type StoreAddress,
  StoreAddressPreview,
  Switch,
  TimeInput,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAddressLabels } from "@/components/use-address-labels";
import { env } from "@/env";
import { useTRPC } from "@/lib/trpc/client";

import { type DayHours, DAYS } from "../data";

/** Day-name (mon…sun) ↔ numeric storage key (0=Sun…6=Sat). */
const DAY_TO_NUM: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
type HoursRecord = Record<string, { open: string; close: string; closed: boolean }>;

function daysFromRecord(rec: HoursRecord | null | undefined): DayHours[] {
  return DAYS.map((day) => {
    const d = rec?.[String(DAY_TO_NUM[day])];
    return { day, open: d?.open ?? "10:00", close: d?.close ?? "21:00", closed: d?.closed ?? false };
  });
}
function recordFromDays(days: DayHours[]): HoursRecord {
  return Object.fromEntries(
    days.map((d) => [String(DAY_TO_NUM[d.day]), { open: d.open, close: d.close, closed: d.closed }]),
  );
}

/**
 * Organization default schedule + contact phone. These are the values a store
 * inherits when its own `hours` / `phone` are unset. (The address below edits
 * the **primary store** — the org has no address.)
 */
export function HoursSection() {
  const t = useTranslations("Settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data } = useQuery(trpc.settings.branding.queryOptions());
  const [days, setDays] = useState<DayHours[]>(daysFromRecord(null));
  const [phone, setPhone] = useState("");
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!data || seeded) return;
    setDays(daysFromRecord(data.defaultHours as HoursRecord | null));
    setPhone(data.phone ?? "");
    setSeeded(true);
  }, [data, seeded]);

  const update = useMutation(
    trpc.settings.updateBranding.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.settings.branding.queryFilter());
        toast.success(t("hours.saved"));
      },
    }),
  );

  const onSave = () =>
    update.mutate({ defaultHours: recordFromDays(days), phone: phone || "" });

  const updateDay = (day: string, patch: Partial<DayHours>) =>
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
                onCheckedChange={(open) => updateDay(dayKey, { closed: !open })}
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
                  <TimeInput value={d.open} onChange={(open) => updateDay(dayKey, { open })} />
                  <span className="text-muted-foreground text-sm">–</span>
                  <TimeInput value={d.close} onChange={(close) => updateDay(dayKey, { close })} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("hours.phone")}</Label>
        <InputPhone size="sm" value={phone} onChange={(v) => setPhone(v.e164)} />
      </div>

      <Button
        className="h-10 rounded-xl font-semibold"
        onClick={onSave}
        disabled={update.isPending}
      >
        {t("hours.save")}
      </Button>

      <div className="border-border space-y-4 border-t pt-4">
        <h3 className="font-display text-base font-semibold tracking-tight">
          {t("hours.locationTitle")}
        </h3>
        <PrimaryStoreLocation />
      </div>
    </section>
  );
}

/** Edits the primary store's structured address inline (the org has no address). */
function PrimaryStoreLocation() {
  const t = useTranslations("Settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const addressLabels = useAddressLabels();

  const provider = useMemo(() => {
    const key = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    return key ? createGooglePlacesProvider({ apiKey: key }) : undefined;
  }, []);

  const { data: store } = useQuery(trpc.stores.primaryRow.queryOptions());
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
          await queryClient.invalidateQueries(trpc.stores.primaryRow.queryFilter());
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
