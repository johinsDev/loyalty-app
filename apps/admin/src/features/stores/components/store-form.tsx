"use client";

import {
  AddressField,
  Button,
  createGooglePlacesProvider,
  Input,
  InputPhone,
  Label,
  type StoreAddress,
  StoreAddressPreview,
  Switch,
  TimeInput,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAddressLabels } from "@/components/use-address-labels";
import { env } from "@/env";
import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

type Draft = {
  name: string;
  address: StoreAddress | null;
  phone: string;
  hoursFrom: string;
  hoursTo: string;
  isPublished: boolean;
};

const EMPTY: Draft = {
  name: "",
  address: null,
  phone: "",
  hoursFrom: "10:00",
  hoursTo: "21:00",
  isPublished: true,
};

/** Uniform weekly hours from a single open/close (per-day editor = fast-follow). */
function buildHours(
  from: string,
  to: string,
): Record<string, { open: string; close: string; closed: boolean }> {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, d) => [String(d), { open: from, close: to, closed: false }]),
  );
}

/**
 * Create / edit a store — `<form onSubmit>` so Enter submits. Address uses the
 * structured `AddressField` (autocomplete → confirm modal with a draggable pin),
 * which carries one `StoreAddress` object; the server derives the formatted
 * string + lat/lng/placeId + the Static Maps shot. Phone uses `InputPhone`.
 */
export function StoreForm({ id }: { id?: string }) {
  const t = useTranslations("Stores");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isEdit = id !== undefined;
  const addressLabels = useAddressLabels();

  const provider = useMemo(() => {
    const key = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    return key ? createGooglePlacesProvider({ apiKey: key }) : undefined;
  }, []);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [seeded, setSeeded] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const { data } = useQuery({
    ...trpc.stores.get.queryOptions({ id: id ?? "" }),
    enabled: isEdit,
  });
  useEffect(() => {
    if (!data || seeded) return;
    const h = (data.hours ?? {}) as Record<string, { open: string; close: string }>;
    const first = h["1"] ?? h["0"];
    // Prefer the structured parts; fall back to the legacy single-line address.
    const address: StoreAddress | null =
      data.addressParts ??
      (data.address
        ? {
            line1: data.address,
            ...(data.lat != null ? { lat: data.lat } : {}),
            ...(data.lng != null ? { lng: data.lng } : {}),
            ...(data.placeId ? { placeId: data.placeId } : {}),
            formatted: data.address,
          }
        : null);
    setDraft({
      name: data.name,
      address,
      phone: data.phone ?? "",
      hoursFrom: first?.open ?? "10:00",
      hoursTo: first?.close ?? "21:00",
      isPublished: data.isPublished,
    });
    setSeeded(true);
  }, [data, seeded]);

  const invalidate = () => queryClient.invalidateQueries(trpc.stores.list.queryFilter());
  const create = useMutation(trpc.stores.create.mutationOptions());
  const update = useMutation(trpc.stores.update.mutationOptions());
  const busy = create.isPending || update.isPending;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = draft.name.trim() || t("namePlaceholder");
    const payload = {
      name,
      address: draft.address,
      phone: draft.phone || undefined,
      hours: buildHours(draft.hoursFrom, draft.hoursTo),
      isPublished: draft.isPublished,
    };
    const opts = {
      onSuccess: async () => {
        await invalidate();
        toast.success(isEdit ? t("updated", { name }) : t("created", { name }));
        router.push("/stores");
      },
      onError: () => toast.error(t("saveError")),
    };
    if (isEdit) update.mutate({ id, ...payload }, opts);
    else create.mutate(payload, opts);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-6 lg:px-8">
      <button
        type="button"
        onClick={() => router.push("/stores")}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </button>

      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {isEdit ? t("editTitle") : t("newTitle")}
      </h1>

      <form
        onSubmit={onSubmit}
        className="bg-card border-border mt-5 space-y-4 rounded-3xl border p-5 shadow-sm sm:p-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor="store-name">{t("fieldName")}</Label>
          <Input
            id="store-name"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={t("namePlaceholder")}
            className="h-10"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("fieldAddress")}</Label>
          <AddressField
            value={draft.address}
            onChange={(address) => set({ address })}
            {...(provider ? { provider } : {})}
            {...(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
              ? { mapsApiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY }
              : {})}
            labels={addressLabels}
          />
        </div>

        {draft.address ? (
          <StoreAddressPreview
            address={draft.address}
            name={draft.name || t("namePlaceholder")}
            mapStaticUrl={data?.mapStaticUrl}
            labels={{ title: t("previewTitle"), empty: t("previewEmpty") }}
          />
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="store-phone">{t("fieldPhone")}</Label>
          <InputPhone
            id="store-phone"
            size="sm"
            value={draft.phone}
            onChange={(v) => set({ phone: v.e164 })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("fieldHours")}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("hoursFrom")}</Label>
              <TimeInput value={draft.hoursFrom} onChange={(v) => set({ hoursFrom: v })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("hoursTo")}</Label>
              <TimeInput value={draft.hoursTo} onChange={(v) => set({ hoursTo: v })} />
            </div>
          </div>
        </div>

        <div className="border-border flex items-center justify-between rounded-2xl border p-3">
          <div>
            <p className="text-sm font-semibold">{t("fieldPublished")}</p>
            <p className="text-muted-foreground text-xs">{t("publishedHint")}</p>
          </div>
          <Switch checked={draft.isPublished} onCheckedChange={(v) => set({ isPublished: v })} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => router.push("/stores")}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-10 rounded-xl font-semibold" disabled={busy}>
            {isEdit ? t("saveChanges") : t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
