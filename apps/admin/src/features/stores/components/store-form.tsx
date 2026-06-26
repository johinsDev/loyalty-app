"use client";

import {
  AddressAutocomplete,
  Button,
  Input,
  InputPhone,
  Label,
  Switch,
  TimeInput,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

type Draft = {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  phone: string;
  hoursFrom: string;
  hoursTo: string;
  isPublished: boolean;
};

const EMPTY: Draft = {
  name: "",
  address: "",
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
 * Places autocomplete (captures lat/lng + placeId → the server generates a Static
 * Maps shot), phone uses `InputPhone`, hours a single open/close. Wired to
 * `stores.create` / `stores.update`.
 */
export function StoreForm({ id }: { id?: string }) {
  const t = useTranslations("Stores");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isEdit = id !== undefined;

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
    setDraft({
      name: data.name,
      address: data.address ?? "",
      lat: data.lat ?? undefined,
      lng: data.lng ?? undefined,
      placeId: data.placeId ?? undefined,
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
    const payload = {
      name: draft.name.trim() || t("namePlaceholder"),
      address: draft.address || undefined,
      lat: draft.lat,
      lng: draft.lng,
      placeId: draft.placeId,
      phone: draft.phone || undefined,
      hours: buildHours(draft.hoursFrom, draft.hoursTo),
      isPublished: draft.isPublished,
    };
    const opts = {
      onSuccess: async () => {
        await invalidate();
        toast.success(
          isEdit ? t("updated", { name: payload.name }) : t("created", { name: payload.name }),
        );
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
          <Label htmlFor="store-address">{t("fieldAddress")}</Label>
          <AddressAutocomplete
            value={draft.address}
            onValueChange={(v) => set({ address: v })}
            onSelect={(p) =>
              set({ address: p.description, lat: p.lat, lng: p.lng, placeId: p.placeId })
            }
          />
        </div>

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
