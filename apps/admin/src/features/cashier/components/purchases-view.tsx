"use client";

import {
  InputPhone,
  isValidE164Phone,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFadeUp } from "@/lib/animate";

import {
  foundCustomer,
  type MemberPurchase,
  memberPurchases,
} from "../data";

/**
 * Compras tab — purchase history. Opens on the last identified socio; the
 * cashier can also look up a specific customer by phone. Tap a row for the
 * itemized receipt detail.
 */
export function PurchasesView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<MemberPurchase | null>(null);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("tabPurchases")}
      </h1>

      <div className="mt-4">
        <div className="text-muted-foreground/70 mb-1.5 text-xs font-extrabold tracking-wider">
          {t("lookupCustomer")}
        </div>
        <InputPhone
          defaultCountry="CO"
          value={phone}
          onChange={(v) => setPhone(v.e164)}
          placeholder={t("enterNumber")}
        />
        {isValidE164Phone(phone) ? (
          <p className="text-muted-foreground mt-1.5 text-xs font-semibold">
            {t("showingFor", { name: foundCustomer.name })}
          </p>
        ) : null}
      </div>

      <div className="text-muted-foreground/70 mt-6 mb-2.5 text-xs font-extrabold tracking-wider">
        {t("memberPurchasesOf", { name: foundCustomer.name })}
      </div>
      <div className="flex flex-col gap-2.5">
        {memberPurchases.map((h, i) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setSelected(h)}
            style={fade(i)}
            className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5 text-left shadow-sm transition-transform active:scale-[0.99]"
          >
            <span className="bg-muted text-muted-foreground grid size-11 flex-none place-items-center rounded-xl">
              <Receipt className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{h.items}</div>
              <div className="text-muted-foreground/70 text-xs font-semibold">
                {h.date}
              </div>
            </div>
            <span
              className={`flex-none text-sm font-extrabold ${h.stamps.startsWith("−") ? "text-muted-foreground" : "text-primary"}`}
            >
              {h.stamps}
            </span>
          </button>
        ))}
      </div>

      <ResponsiveModal
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          {selected ? (
            <div className="flex flex-col px-6 pt-2 pb-6">
              <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
                {t("receiptTitle")}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-muted-foreground text-sm font-semibold">
                {selected.date} · {selected.store}
              </ResponsiveModalDescription>

              <div className="bg-muted mt-4 flex flex-col gap-2 rounded-2xl p-4">
                {selected.lines.map((line) => (
                  <div
                    key={line}
                    className="text-foreground text-sm font-semibold"
                  >
                    {line}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider">
                  {selected.stamps.startsWith("−")
                    ? t("stampsSpent")
                    : t("stampsEarned")}
                </span>
                <span
                  className={`text-lg font-extrabold ${selected.stamps.startsWith("−") ? "text-muted-foreground" : "text-primary"}`}
                >
                  {selected.stamps} {t("stampMany")}
                </span>
              </div>
              <div className="text-muted-foreground/70 mt-1 text-xs font-semibold">
                {t("attendedBy", { name: selected.cashier })}
              </div>

              <ResponsiveModalClose
                variant="secondary"
                className="mt-6 h-14 w-full rounded-2xl text-base"
              >
                {t("close")}
              </ResponsiveModalClose>
            </div>
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
