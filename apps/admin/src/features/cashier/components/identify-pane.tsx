"use client";

import {
  Button,
  type CountryCode,
  InputPhone,
  isValidE164Phone,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { ArrowLeft, Check, KeyRound, QrCode, User, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { useActiveStoreId } from "../use-active-store";

export type IdentifiedCustomer = { id: string; name: string | null; phone: string };

/**
 * Cashier identify pane — customer-first, obligatory (no anonymous sale). Look a
 * customer up by phone (country picker defaults to the org's country); if they
 * don't exist, quick-register them (name + phone) with a WhatsApp PIN the
 * customer reads back before the account is created. Resolves to
 * `onSelect(customer)` either way.
 */
export function IdentifyPane({
  onSelect,
  onScan,
}: {
  onSelect: (c: IdentifiedCustomer) => void;
  /** Jump to the QR scanner — resolves a reward QR straight into the register. */
  onScan: () => void;
}) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const fade = useFadeUp();
  const activeStoreId = useActiveStoreId();

  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"lookup" | "pin">("lookup");
  const [regName, setRegName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  const loc = useQuery(trpc.settings.localization.queryOptions());
  const defaultCountry = (loc.data?.defaultPhoneCountry ?? "CO") as CountryCode;

  const debounced = useDebounce(phone, { wait: 300 });
  const search = useQuery(
    trpc.customers.search.queryOptions(
      { query: debounced, limit: 8 },
      { enabled: isValidE164Phone(debounced) },
    ),
  );
  const results = search.data ?? [];
  const valid = isValidE164Phone(phone);
  const showRegister = valid && !search.isFetching && results.length === 0;

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
      <div className="bg-card border-border mx-auto max-w-md rounded-3xl border p-6 shadow-sm">
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
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("registerPinTitle")}
        </h1>
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

  // ── Lookup by phone ─────────────────────────────────────────────────────────
  return (
    <div className="bg-card border-border rounded-3xl border p-6 shadow-sm">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("identifyTitle")}</h1>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">{t("identifyPhoneHint")}</p>

      <InputPhone
        key={defaultCountry}
        size="sm"
        defaultCountry={defaultCountry}
        value={phone}
        onChange={(v) => setPhone(v.e164)}
        placeholder={t("searchPlaceholder")}
      />

      {valid && results.length > 0 ? (
        <div className="mt-4 flex flex-col">
          {results.map((hit, i) => (
            <button
              key={hit.id}
              type="button"
              style={fade(i)}
              onClick={() => onSelect({ id: hit.id, name: hit.name, phone: hit.phone })}
              className="border-border hover:bg-muted flex items-center gap-3 border-b py-3 text-left last:border-0"
            >
              <span className="bg-muted text-muted-foreground grid size-10 flex-none place-items-center rounded-xl">
                <User className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">
                  {hit.name?.trim() || hit.phone}
                </div>
                <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                  {hit.phone}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {showRegister ? (
        <div className="border-border bg-muted/40 mt-4 rounded-2xl border p-4">
          <div className="text-foreground inline-flex items-center gap-1.5 text-sm font-extrabold">
            <UserPlus className="text-primary size-4" />
            {t("quickRegisterTitle")}
          </div>
          <p className="text-muted-foreground mt-1 text-xs font-semibold">
            {t("quickRegisterHint")}
          </p>
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
      ) : null}

      {/* Alternative entry: scan the customer's reward QR to jump straight in. */}
      <div className="mt-5 flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
          {t("orLabel")}
        </span>
        <span className="bg-border h-px flex-1" />
      </div>
      <button
        type="button"
        onClick={onScan}
        className="border-border bg-card text-foreground hover:bg-muted mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-bold"
      >
        <QrCode className="size-4" />
        {t("scanCustomerQr")}
      </button>
    </div>
  );
}
