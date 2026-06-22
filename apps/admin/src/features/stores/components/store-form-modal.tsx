"use client";

import {
  AddressAutocomplete,
  Button,
  Input,
  Label,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { emptyStoreDraft, getStoreDraft, type Store, type StoreDraft } from "../data";

/**
 * Create / edit a store in a ResponsiveModal — a single `<form onSubmit>` so
 * Enter submits. Name / phone / hours are plain inputs; the address uses the UI
 * `AddressAutocomplete` (falls back to a plain input without a Google key).
 * Design-first: submit just toasts + closes; the seam is a tRPC mutation later.
 */
export function StoreFormModal({
  open,
  onOpenChange,
  store,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store?: Store;
}) {
  const t = useTranslations("Stores");
  const isEdit = store !== undefined;
  const [draft, setDraft] = useState<StoreDraft>(emptyStoreDraft);

  // Reseed the draft whenever the modal opens (fresh for create, the store for
  // edit) so reopening never shows stale input from a previous session.
  useEffect(() => {
    if (!open) return;
    setDraft(store ? getStoreDraft(store.id) : emptyStoreDraft);
  }, [open, store]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = draft.name.trim() || t("namePlaceholder");
    toast.success(isEdit ? t("updated", { name }) : t("created", { name }));
    onOpenChange(false);
  };

  const set = (patch: Partial<StoreDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {isEdit ? t("editTitle") : t("newTitle")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="sr-only">
              {isEdit ? t("editTitle") : t("newTitle")}
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2">
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
              <Input
                id="store-phone"
                value={draft.phone}
                onChange={(e) => set({ phone: e.target.value })}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-hours">{t("fieldHours")}</Label>
              <Input
                id="store-hours"
                value={draft.hours}
                onChange={(e) => set({ hours: e.target.value })}
                placeholder={t("hoursPlaceholder")}
                className="h-10"
              />
            </div>
          </div>

          <ResponsiveModalFooter>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" className="h-10 rounded-xl font-semibold">
              {isEdit ? t("saveChanges") : t("save")}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
