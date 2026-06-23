"use client";

import {
  AddressAutocomplete,
  Button,
  Input,
  InputPhone,
  Label,
  TimeInput,
} from "@loyalty/ui";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";

import { emptyStoreDraft, getStoreDraft, type StoreDraft } from "../data";

/**
 * Create / edit a store on its own page — a single `<form onSubmit>` so Enter
 * submits. Address uses `AddressAutocomplete`, phone uses `InputPhone`, hours use
 * two `TimeInput`s. Design-first: submit toasts + returns to the list; the seam
 * is a tRPC mutation later.
 */
export function StoreForm({ id }: { id?: string }) {
  const t = useTranslations("Stores");
  const router = useRouter();
  const isEdit = id !== undefined;
  const [draft, setDraft] = useState<StoreDraft>(
    id ? getStoreDraft(id) : emptyStoreDraft,
  );

  const set = (patch: Partial<StoreDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = draft.name.trim() || t("namePlaceholder");
    toast.success(isEdit ? t("updated", { name }) : t("created", { name }));
    router.push("/stores");
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
          <Label htmlFor="store-hours">{t("fieldHours")}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("hoursFrom")}</Label>
              <TimeInput
                value={draft.hoursFrom}
                onChange={(v) => set({ hoursFrom: v })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("hoursTo")}</Label>
              <TimeInput
                value={draft.hoursTo}
                onChange={(v) => set({ hoursTo: v })}
              />
            </div>
          </div>
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
          <Button type="submit" className="h-10 rounded-xl font-semibold">
            {isEdit ? t("saveChanges") : t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
