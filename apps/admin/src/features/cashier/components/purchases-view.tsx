"use client";

import { InputPhone, isValidE164Phone } from "@loyalty/ui";
import { Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFadeUp } from "@/lib/animate";

import { foundCustomer, memberPurchases } from "../data";

/**
 * Compras tab — purchase history. Opens on the last identified socio; the
 * cashier can also look up a specific customer by phone to review theirs.
 */
export function PurchasesView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const [phone, setPhone] = useState("");

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("tabPurchases")}
      </h1>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <div className="text-muted-foreground/70 mb-1.5 text-xs font-extrabold tracking-wider">
            {t("lookupCustomer")}
          </div>
          <InputPhone
            defaultCountry="CO"
            value={phone}
            onChange={(v) => setPhone(v.e164)}
            placeholder={t("enterNumber")}
          />
        </div>
        {isValidE164Phone(phone) ? (
          <span className="text-muted-foreground text-xs font-semibold">
            {t("showingFor", { name: foundCustomer.name })}
          </span>
        ) : null}
      </div>

      <div className="text-muted-foreground/70 mt-6 mb-2.5 text-xs font-extrabold tracking-wider">
        {t("memberPurchasesOf", { name: foundCustomer.name })}
      </div>
      <div className="flex flex-col gap-2.5">
        {memberPurchases.map((h, i) => (
          <div
            key={h.id}
            style={fade(i)}
            className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm"
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
          </div>
        ))}
      </div>
    </div>
  );
}
