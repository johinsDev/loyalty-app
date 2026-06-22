"use client";

import {
  Button,
  Input,
  InputPhone,
  Label,
  NativeSelect,
  NativeSelectOption,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import type { Customer, Tier } from "../data";

const TIERS: Tier[] = ["bronze", "silver", "gold", "diamond"];

/**
 * Add / edit customer form in a ResponsiveModal (drawer on mobile, dialog on
 * desktop). `<form onSubmit>` so Enter submits. Design-first: a successful
 * submit toasts + closes — the tRPC `clientes.create/update` mutation is the
 * seam. `customer` present → edit mode, prefilled.
 */
export function CustomerFormModal({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer;
}) {
  const t = useTranslations("Customers");
  const formId = useId();
  const editing = Boolean(customer);

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [birthday, setBirthday] = useState("");
  const [tier, setTier] = useState<Tier>(customer?.tier ?? "bronze");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    toast.success(editing ? t("updated", { name }) : t("created", { name }));
    onOpenChange(false);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <form onSubmit={onSubmit} className="flex flex-col px-6 pt-2 pb-6">
          <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
            {editing ? t("formEditTitle") : t("formAddTitle")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
            {t("formSubtitle")}
          </ResponsiveModalDescription>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-name`}>{t("fieldName")}</Label>
              <Input
                id={`${formId}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("fieldNamePlaceholder")}
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-phone`}>{t("fieldPhone")}</Label>
              <InputPhone
                id={`${formId}-phone`}
                value={phone}
                onChange={(v) => setPhone(v.e164)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-bday`}>{t("fieldBirthday")}</Label>
                <Input
                  id={`${formId}-bday`}
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  placeholder={t("fieldBirthdayPlaceholder")}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-tier`}>{t("fieldTier")}</Label>
                <NativeSelect
                  id={`${formId}-tier`}
                  value={tier}
                  onChange={(e) => setTier(e.target.value as Tier)}
                  className="h-11 rounded-xl"
                >
                  {TIERS.map((tr) => (
                    <NativeSelectOption key={tr} value={tr}>
                      {t(`tier.${tr}`)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" className="h-11 rounded-xl font-semibold">
              {editing ? t("saveChanges") : t("create")}
            </Button>
          </div>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
