"use client";

import { Button, type CountryCode, toPhoneValue } from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { ArrowLeft, Check, ChevronRight, KeyRound, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { useActiveStoreId } from "../use-active-store";

import { NumpadPhone } from "./numpad-phone";

export type IdentifiedCustomer = { id: string; name: string | null; phone: string };

/**
 * Cashier phone-lookup pane — customer-first, obligatory (no anonymous sale).
 * An on-screen numpad (country picker defaults to the org's country) drives the
 * lookup; if the socio doesn't exist, quick-register them (name + phone) with a
 * WhatsApp PIN they read back before the account is created. Resolves to
 * `onSelect(customer)` either way. Renders bare — the identify view wraps it in
 * the card + tab shell.
 */
export function IdentifyPane({ onSelect }: { onSelect: (c: IdentifiedCustomer) => void }) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const fade = useFadeUp();
  const activeStoreId = useActiveStoreId();

  const loc = useQuery(trpc.settings.localization.queryOptions());
  const defaultCountry = (loc.data?.defaultPhoneCountry ?? "CO") as CountryCode;

  const [countryOverride, setCountryOverride] = useState<CountryCode | null>(null);
  const country = countryOverride ?? defaultCountry;
  const [digits, setDigits] = useState("");

  const [step, setStep] = useState<"lookup" | "pin">("lookup");
  const [regName, setRegName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  const pv = toPhoneValue(digits, country);
  const phone = pv.e164;
  const valid = pv.isValid;

  const debounced = useDebounce(phone, { wait: 300 });
  const search = useQuery(
    trpc.customers.search.queryOptions(
      { query: debounced, limit: 8 },
      { enabled: valid && debounced.length > 0 },
    ),
  );
  const results = search.data ?? [];

  const requestPin = useMutation(trpc.customers.requestRegisterPin.mutationOptions());
  const confirmPin = useMutation(trpc.customers.confirmRegisterPin.mutationOptions());

  const startRegister = async () => {
    try {
      const res = await requestPin.mutateAsync({
        phone,
        name: regName.trim() || undefined,
        storeId: activeStoreId ?? undefined,
      });
      setPendingId(res.pendingId);
      setPin("");
      setStep("pin");
      toast.success(t("pinSent"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg === "PHONE_IN_USE" ? t("phoneInUse") : t("pinRequestError"));
    }
  };

  const confirmRegister = async () => {
    if (!pendingId) return;
    try {
      const res = await confirmPin.mutateAsync({ pendingId, code: pin.trim() });
      onSelect({ id: res.id, name: res.name, phone: res.phone });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "CODE_INVALID") toast.error(t("codeInvalid"));
      else if (msg === "CODE_EXPIRED") toast.error(t("codeExpired"));
      else if (msg === "TOO_MANY_ATTEMPTS") toast.error(t("codeTooMany"));
      else if (msg === "PHONE_IN_USE") toast.error(t("phoneInUse"));
      else toast.error(t("codeConfirmError"));
    }
  };

  // ── PIN entry (blocking): the account is created only once confirmed ────────
  if (step === "pin") {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setStep("lookup");
            setPendingId(null);
            setPin("");
          }}
          className="text-muted-foreground mb-3.5 flex items-center gap-1 text-sm font-bold"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </button>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {t("registerPinTitle")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("registerPinHint", { phone })}</p>
        <label className="text-muted-foreground/70 mt-4 mb-1.5 block text-[0.6875rem] font-extrabold tracking-wider">
          {t("codeLabel")}
        </label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          className="border-border bg-muted placeholder:text-muted-foreground/50 font-display h-12 w-full rounded-2xl border px-3.5 text-center text-2xl font-semibold tracking-[0.4em] tabular-nums outline-none"
        />
        <Button
          variant="default"
          size="lg"
          disabled={pin.trim().length !== 6 || confirmPin.isPending}
          onClick={() => void confirmRegister()}
          className="mt-4 h-10 w-full gap-2 rounded-2xl text-base font-extrabold"
        >
          <Check className="size-5" />
          {t("registerPinConfirm")}
        </Button>
        <button
          type="button"
          disabled={requestPin.isPending}
          onClick={() => void startRegister()}
          className="text-muted-foreground hover:text-foreground mt-3 w-full text-center text-xs font-bold"
        >
          {t("registerPinResend")}
        </button>
      </div>
    );
  }

  // ── Lookup by phone (numpad) ────────────────────────────────────────────────
  return (
    <div>
      <NumpadPhone
        country={country}
        onCountryChange={setCountryOverride}
        digits={digits}
        onDigitsChange={setDigits}
        placeholder={t("phonePlaceholder")}
        countryLabel={t("countryLabel")}
        backspaceLabel={t("backspaceLabel")}
      />

      {/* Status-driven: guide → typing → searching → results → register. */}
      {digits.length === 0 ? (
        <p className="text-muted-foreground/70 mt-4 text-center text-xs font-semibold">
          {t("numpadHint")}
        </p>
      ) : !valid ? (
        <p className="text-muted-foreground/70 mt-4 text-center text-xs font-semibold">
          {t("numpadKeepTyping")}
        </p>
      ) : search.isFetching ? (
        <p className="text-muted-foreground mt-4 text-center text-xs font-semibold">
          {t("searching")}
        </p>
      ) : results.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {results.map((hit, i) => (
            <button
              key={hit.id}
              type="button"
              style={fade(i)}
              onClick={() => onSelect({ id: hit.id, name: hit.name, phone: hit.phone })}
              className="border-border hover:border-primary/50 hover:bg-muted flex items-center gap-3 rounded-2xl border p-3 text-left"
            >
              <span className="bg-primary/10 text-primary font-display grid size-11 flex-none place-items-center rounded-xl text-sm font-extrabold">
                {(hit.name?.trim()?.[0] ?? "#").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold">
                  {hit.name?.trim() || hit.phone}
                </div>
                <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                  {hit.name?.trim() ? hit.phone : t("tapToRegisterSale")}
                </div>
              </div>
              <ChevronRight className="text-muted-foreground/50 size-5 flex-none" />
            </button>
          ))}
        </div>
      ) : (
        <div className="border-border bg-muted/40 mt-4 rounded-2xl border p-4">
          <div className="text-foreground inline-flex items-center gap-1.5 text-sm font-extrabold">
            <UserPlus className="text-primary size-4" />
            {t("quickRegisterNotFound")}
          </div>
          <p className="text-muted-foreground mt-1 text-xs font-semibold">{t("quickRegisterHint")}</p>
          <input
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            placeholder={t("quickRegisterName")}
            className="border-border bg-card placeholder:text-muted-foreground/70 mt-3 h-10 w-full rounded-2xl border px-3.5 text-sm font-semibold outline-none"
          />
          <Button
            variant="default"
            size="lg"
            disabled={requestPin.isPending}
            onClick={() => void startRegister()}
            className="mt-3 h-10 w-full gap-2 rounded-2xl text-base font-extrabold"
          >
            <KeyRound className="size-4" />
            {t("quickRegisterSend")}
          </Button>
        </div>
      )}
    </div>
  );
}
