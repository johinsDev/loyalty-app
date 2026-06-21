"use client";

import {
  Button,
  InputPhone,
  isValidE164Phone,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import {
  AlertTriangle,
  ArrowLeft,
  Cake,
  Check,
  Delete,
  Gift,
  Minus,
  Phone,
  Plus,
  QrCode,
  Search,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useFadeUp } from "@/lib/animate";

import {
  DAILY_CAP,
  STAMPS_TODAY,
  foundCustomer as CUST,
  manager,
  memberDetail,
  products,
  recentMoves,
  redeemReward as RR,
} from "../data";

type Step =
  | "identify"
  | "phone"
  | "found"
  | "success"
  | "redeem-scan"
  | "redeem-detail"
  | "redeem-success";

/**
 * Escanear tab — identify a socio (scan QR / phone), see their detail, mark the
 * purchased products (search + most-used quick-add) and confirm the earn; or
 * validate a redemption (scan code → reward detail → manager-PIN override →
 * success). Design-first/hardcoded.
 */
export function ScanView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const [step, setStep] = useState<Step>("identify");
  const [phone, setPhone] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [lastStamps, setLastStamps] = useState(0);
  const [mgrOpen, setMgrOpen] = useState(false);
  const [mgrPin, setMgrPin] = useState("");

  const enoughToRedeem = CUST.stamps >= RR.cost;
  const pressMgr = (n: string) => {
    const pin = (mgrPin + n).slice(0, 4);
    setMgrPin(pin);
    if (pin.length === 4) {
      setTimeout(() => {
        setMgrOpen(false);
        setMgrPin("");
        setStep("redeem-success");
      }, 200);
    }
  };

  const total = useMemo(
    () => products.reduce((s, p) => s + (cart[p.id] ?? 0) * p.earns, 0),
    [cart],
  );
  const capReached = STAMPS_TODAY >= DAILY_CAP;
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const mostUsed = products.slice(0, 3);

  const add = (id: string) =>
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const dec = (id: string) =>
    setCart((c) => {
      const n = { ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) };
      if (n[id] === 0) delete n[id];
      return n;
    });

  const reset = () => {
    setStep("identify");
    setCart({});
    setPhone("");
    setQuery("");
    setMgrOpen(false);
    setMgrPin("");
  };
  const confirm = () => {
    if (STAMPS_TODAY + total > DAILY_CAP) {
      setCapOpen(true);
      return;
    }
    setLastStamps(total);
    setStep("success");
  };

  const newStamps = Math.min(CUST.stampGoal, CUST.stamps + lastStamps);
  const toGoal = Math.max(0, CUST.stampGoal - newStamps);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      {step === "identify" && (
        <div className="flex flex-col gap-5">
          <div className="bg-card border-border rounded-3xl border p-6 shadow-sm">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {t("identifyTitle")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("identifyHint")}
            </p>
            <ScanFrame caption={t("aimCamera")} />
            <Button
              variant="gradient"
              size="lg"
              onClick={() => setStep("found")}
              className="h-16 w-full gap-3 rounded-2xl text-lg font-extrabold"
            >
              <QrCode className="size-6" />
              {t("scanMemberQr")}
            </Button>
            <button
              type="button"
              onClick={() => {
                setPhone("");
                setStep("phone");
              }}
              className="border-border bg-card text-foreground mt-2.5 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border text-base font-bold"
            >
              <Phone className="size-5" />
              {t("enterPhone")}
            </button>
            <button
              type="button"
              onClick={() => setStep("redeem-scan")}
              className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 mt-2.5 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border text-base font-bold"
            >
              <Gift className="size-5" />
              {t("validateRedeem")}
            </button>
          </div>

          <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
            <div className="text-muted-foreground/70 mb-1.5 text-xs font-extrabold tracking-wider">
              {t("recentMoves")}
            </div>
            {recentMoves.map((r, i) => (
              <div
                key={r.id}
                style={fade(i)}
                className="border-border flex items-center gap-3 border-b py-3 last:border-0"
              >
                <span className="bg-muted grid size-10 flex-none place-items-center rounded-xl text-lg">
                  {r.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{r.name}</div>
                  <div className="text-muted-foreground/70 text-xs font-semibold">
                    {r.detail}
                  </div>
                </div>
                <div
                  className={`text-sm font-extrabold ${r.kind === "redeem" ? "text-muted-foreground" : "text-primary"}`}
                >
                  {r.amount}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "phone" && (
        <div className="bg-card border-border mx-auto max-w-md rounded-3xl border p-6 shadow-sm">
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground mb-3.5 flex items-center gap-1 text-sm font-bold"
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("phoneTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 mb-4 text-sm">
            {t("phoneHint")}
          </p>
          <div className="mb-4">
            <InputPhone
              defaultCountry="CO"
              value={phone}
              onChange={(v) => setPhone(v.e164)}
              placeholder={t("enterNumber")}
            />
          </div>
          <Button
            variant="gradient"
            size="lg"
            disabled={!isValidE164Phone(phone)}
            onClick={() => setNotFoundOpen(true)}
            className="h-14 w-full rounded-2xl text-base font-extrabold"
          >
            {t("searchMember")}
          </Button>
        </div>
      )}

      {step === "found" && (
        <div className="flex flex-col gap-5 pb-24">
          {/* member card */}
          <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
            <div className="flex items-center gap-3.5">
              <span
                className="font-display grid size-14 flex-none place-items-center rounded-full text-xl font-semibold text-amber-900"
                style={{ backgroundImage: "linear-gradient(150deg,#ffd0ad,#ff9d6e)" }}
              >
                {CUST.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-extrabold">{CUST.name}</div>
                <div className="text-muted-foreground text-sm font-semibold">
                  {CUST.phone} · {CUST.tierEmoji} {CUST.tier}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="border-border bg-card text-muted-foreground hover:text-foreground flex-none rounded-full border px-3 py-1.5 text-xs font-bold"
              >
                {t("viewDetail")}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-2xl p-3.5">
                <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                  {t("stamps")}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="font-display text-2xl font-semibold">
                    {CUST.stamps}
                  </span>
                  <span className="text-muted-foreground/70 text-sm font-bold">
                    / {CUST.stampGoal}
                  </span>
                </div>
              </div>
              <div className="bg-muted rounded-2xl p-3.5">
                <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                  {t("points")}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="font-display text-primary text-2xl font-semibold">
                    {CUST.points}
                  </span>
                  <span className="text-muted-foreground/70 text-sm font-bold">
                    pts
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-muted-foreground mt-3 flex items-center gap-1.5 text-sm font-bold"
            >
              <X className="size-4" />
              {t("cancelIdentify")}
            </button>
          </div>

          {/* picker */}
          <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {t("markProducts")}
              </h2>
              <span className="text-muted-foreground/70 text-xs font-bold">
                {t("noPrices")}
              </span>
            </div>
            <div className="border-border bg-muted mb-3 flex h-11 items-center gap-2 rounded-2xl border px-3.5">
              <Search className="text-muted-foreground/70 size-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("menuSearch")}
                className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm font-semibold outline-none"
              />
            </div>
            {!query ? (
              <div className="mb-3">
                <div className="text-muted-foreground/70 mb-2 text-[0.6875rem] font-extrabold tracking-wider">
                  {t("mostUsed")}
                </div>
                <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {mostUsed.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => add(p.id)}
                      className="border-border bg-card flex h-10 flex-none items-center gap-2 rounded-full border px-3 text-sm font-bold"
                    >
                      <span>{p.emoji}</span>
                      {p.name}
                      <Plus className="text-primary size-4" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filtered.map((p, i) => {
                const qty = cart[p.id] ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => add(p.id)}
                    style={fade(i)}
                    className={`flex flex-col gap-2.5 rounded-2xl border p-3.5 text-left transition-colors ${qty > 0 ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="bg-muted grid size-10 place-items-center rounded-xl text-xl">
                        {p.emoji}
                      </span>
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-1 text-[0.6875rem] font-extrabold">
                        +{p.earns}
                      </span>
                    </div>
                    <div className="text-sm leading-tight font-bold">{p.name}</div>
                    {qty > 0 ? (
                      <div className="flex items-center justify-between">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            dec(p.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") dec(p.id);
                          }}
                          className="border-border bg-card grid size-8 cursor-pointer place-items-center rounded-lg border"
                        >
                          <Minus className="size-4" />
                        </span>
                        <span className="text-base font-extrabold">{qty}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            add(p.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") add(p.id);
                          }}
                          className="border-border bg-card grid size-8 cursor-pointer place-items-center rounded-lg border"
                        >
                          <Plus className="size-4" />
                        </span>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* sticky confirm */}
          <div className="bg-card border-border fixed inset-x-0 bottom-[4.5rem] z-20 border-t px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 lg:max-w-4xl">
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                  {t("willAward")}
                </span>
                <span className="font-display text-primary text-2xl font-semibold">
                  +{total}
                </span>
                <span className="text-muted-foreground text-sm font-bold">
                  {total === 1 ? t("stampOne") : t("stampMany")}
                </span>
              </div>
              <Button
                variant="gradient"
                size="lg"
                onClick={confirm}
                disabled={total === 0 || capReached}
                className="h-13 gap-2 rounded-2xl text-base font-extrabold whitespace-nowrap sm:px-8"
              >
                <Check className="size-5" />
                {t("confirmEarn", { count: total })}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="flex flex-col items-center gap-3.5 py-10 text-center">
          <div className="from-primary to-primary/80 grid size-24 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-xl">
            <Check className="size-12" strokeWidth={3} />
          </div>
          <div className="font-display text-4xl font-semibold tracking-tight">
            +{lastStamps} {t("stampMany")}
          </div>
          <div className="text-muted-foreground text-base">
            {t("forCustomer")}{" "}
            <strong className="text-foreground">{CUST.name}</strong>
          </div>
          <div className="bg-card border-border mt-1 flex items-center gap-4 rounded-2xl border p-4">
            <div className="text-left">
              <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                {t("newBalance")}
              </div>
              <div className="text-lg font-extrabold">
                {newStamps}/{CUST.stampGoal} {t("stampMany")}
              </div>
            </div>
            <div className="bg-border h-8 w-px" />
            <div className="text-left">
              <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                {t("points")}
              </div>
              <div className="text-primary text-lg font-extrabold">
                {CUST.points + lastStamps * 8}
              </div>
            </div>
          </div>
          <div className="bg-primary/10 text-primary mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold">
            🎯{" "}
            {toGoal === 0
              ? t("nudgeComplete")
              : t("nudgeToGo", { count: toGoal })}
          </div>
          <Button
            variant="gradient"
            size="lg"
            onClick={reset}
            className="mt-3 h-14 w-full max-w-xs rounded-2xl text-base font-extrabold"
          >
            {t("nextMember")}
          </Button>
        </div>
      )}

      {/* ---- REDEEM: scan code ---- */}
      {step === "redeem-scan" && (
        <div className="bg-card border-border mx-auto max-w-md rounded-3xl border p-6 shadow-sm">
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground mb-3.5 flex items-center gap-1 text-sm font-bold"
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("scanRedeemTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("scanRedeemHint")}
          </p>
          <ScanFrame />
          <Button
            variant="gradient"
            size="lg"
            onClick={() => setStep("redeem-detail")}
            className="h-14 w-full rounded-2xl text-base font-extrabold"
          >
            {t("scanRedeemCode")}
          </Button>
        </div>
      )}

      {/* ---- REDEEM: reward detail ---- */}
      {step === "redeem-detail" && (
        <div className="bg-card border-border mx-auto max-w-md rounded-3xl border p-6 shadow-sm">
          <button
            type="button"
            onClick={() => setStep("redeem-scan")}
            className="text-muted-foreground mb-3.5 flex items-center gap-1 text-sm font-bold"
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </button>
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide">
            <Check className="size-4" />
            {t("codeValid")}
          </span>
          <div className="mt-4 flex items-center gap-4">
            <span className="bg-muted grid size-18 flex-none place-items-center rounded-2xl text-4xl">
              {RR.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-2xl leading-tight font-semibold tracking-tight">
                {RR.name}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">{RR.desc}</div>
            </div>
          </div>
          <div className="bg-muted mt-5 flex items-center justify-between rounded-2xl p-4">
            <div>
              <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                {t("cost")}
              </div>
              <div className="text-xl font-extrabold">
                {RR.cost} {t("stampMany")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                {t("memberBalance")}
              </div>
              <div
                className={`text-xl font-extrabold ${enoughToRedeem ? "text-foreground" : "text-rose-500"}`}
              >
                {CUST.stamps} {t("stampMany")}
              </div>
            </div>
          </div>
          {enoughToRedeem ? (
            <Button
              variant="gradient"
              size="lg"
              onClick={() => {
                setMgrPin("");
                setMgrOpen(true);
              }}
              className="mt-5 h-14 w-full rounded-2xl text-base font-extrabold"
            >
              {t("confirmRedeem")}
            </Button>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-rose-500/10 px-4 py-3.5 text-sm font-bold text-rose-500">
                <AlertTriangle className="size-4" />
                {t("insufficientShort", { count: RR.cost - CUST.stamps })}
              </div>
              <Button
                variant="gradient"
                size="lg"
                disabled
                className="mt-3 h-14 w-full rounded-2xl text-base font-extrabold"
              >
                {t("confirmRedeem")}
              </Button>
            </>
          )}
        </div>
      )}

      {/* ---- REDEEM: success ---- */}
      {step === "redeem-success" && (
        <div className="flex flex-col items-center gap-3.5 py-10 text-center">
          <div className="from-primary to-primary/80 grid size-24 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-xl">
            <Check className="size-12" strokeWidth={3} />
          </div>
          <div className="font-display text-3xl font-semibold tracking-tight">
            {t("redeemValidated")}
          </div>
          <div className="text-muted-foreground text-base">
            {t("handReward")}{" "}
            <strong className="text-foreground">{RR.name}</strong>{" "}
            {t("toCustomer", { name: CUST.name })}
          </div>
          <div className="bg-card border-border rounded-2xl border p-3.5 px-5 text-sm">
            <span className="text-muted-foreground/70 font-bold">
              {t("remainingBalance")}
            </span>{" "}
            <strong>
              {Math.max(0, CUST.stamps - RR.cost)} {t("stampMany")}
            </strong>{" "}
            · {t("approvedBy", { name: manager.name })}
          </div>
          <Button
            variant="gradient"
            size="lg"
            onClick={reset}
            className="mt-3 h-14 w-full max-w-xs rounded-2xl text-base font-extrabold"
          >
            {t("done")}
          </Button>
        </div>
      )}

      {/* manager PIN override */}
      <ResponsiveModal open={mgrOpen} onOpenChange={setMgrOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex flex-col px-6 pt-2 pb-6">
            <div className="text-center">
              <div className="text-xs font-extrabold tracking-wider text-amber-600">
                {t("approvalRequired")}
              </div>
              <ResponsiveModalTitle className="font-display mt-0.5 text-2xl font-semibold">
                {t("supervisorPin")}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
                {t("supervisorPinHint")}
              </ResponsiveModalDescription>
            </div>
            <div className="flex justify-center gap-3.5 py-4">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`size-4 rounded-full border-2 ${i < mgrPin.length ? "bg-primary border-primary" : "border-border"}`}
                />
              ))}
            </div>
            <Keypad
              onPress={pressMgr}
              onBack={() => setMgrPin((p) => p.slice(0, -1))}
            />
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* member detail */}
      <ResponsiveModal open={detailOpen} onOpenChange={setDetailOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex flex-col gap-3 px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {CUST.name}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground text-sm font-semibold">
              {CUST.phone} · {CUST.tierEmoji} {CUST.tier}
            </ResponsiveModalDescription>
            <div className="grid grid-cols-2 gap-2.5">
              <DetailTile icon={<Cake className="size-4" />} label={t("birthday")} value={memberDetail.birthday} />
              <DetailTile label={t("memberSince")} value={memberDetail.memberSince} />
              <DetailTile label={t("email")} value={memberDetail.email} />
              <DetailTile label={t("visits")} value={`${memberDetail.visits}`} />
            </div>
            <ResponsiveModalClose
              variant="secondary"
              className="mt-2 h-14 w-full rounded-2xl text-base"
            >
              {t("close")}
            </ResponsiveModalClose>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* daily cap */}
      <StateModal
        open={capOpen}
        onClose={() => setCapOpen(false)}
        emoji="⚠️"
        title={t("err.cap.title")}
        body={t("err.cap.body")}
        cta={t("err.cap.cta")}
      />
      {/* not found */}
      <StateModal
        open={notFoundOpen}
        onClose={() => setNotFoundOpen(false)}
        emoji="🔍"
        title={t("err.notfound.title")}
        body={t("err.notfound.body")}
        cta={t("err.notfound.cta")}
      />
    </div>
  );
}

function DetailTile({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted rounded-2xl p-3.5">
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-[0.6875rem] font-extrabold tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-foreground mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function StateModal({
  open,
  onClose,
  emoji,
  title,
  body,
  cta,
}: {
  open: boolean;
  onClose: () => void;
  emoji: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center px-6 pt-2 pb-6 text-center">
          <span className="bg-muted mb-4 grid size-20 place-items-center rounded-3xl text-4xl">
            {emoji}
          </span>
          <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
            {title}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {body}
          </ResponsiveModalDescription>
          <ResponsiveModalClose
            variant="gradient"
            className="mt-6 h-14 w-full rounded-2xl text-base"
          >
            {cta}
          </ResponsiveModalClose>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function Keypad({
  onPress,
  onBack,
}: {
  onPress: (n: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
        <KeyBtn key={n} onClick={() => onPress(n)}>
          {n}
        </KeyBtn>
      ))}
      <span />
      <KeyBtn onClick={() => onPress("0")}>0</KeyBtn>
      <KeyBtn ghost onClick={onBack}>
        <Delete className="size-5" />
      </KeyBtn>
    </div>
  );
}

function KeyBtn({
  ghost,
  onClick,
  children,
}: {
  ghost?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-display grid h-14 place-items-center rounded-2xl text-2xl font-semibold transition-transform active:scale-95 ${ghost ? "text-muted-foreground" : "border-border bg-card text-foreground border"}`}
    >
      {children}
    </button>
  );
}

function ScanFrame({ caption }: { caption?: string }) {
  return (
    <div
      className="relative my-5 flex h-52 items-center justify-center overflow-hidden rounded-3xl"
      style={{ background: "#0a1626" }}
    >
      <div className="relative aspect-square w-1/2">
        {[
          "top-0 left-0 rounded-tl-lg border-t-4 border-l-4",
          "top-0 right-0 rounded-tr-lg border-t-4 border-r-4",
          "bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4",
          "bottom-0 right-0 rounded-br-lg border-b-4 border-r-4",
        ].map((c) => (
          <span key={c} className={`border-primary absolute size-8 ${c}`} />
        ))}
      </div>
      {caption ? (
        <div className="absolute inset-x-0 bottom-3.5 text-center text-xs font-semibold text-white/80">
          {caption}
        </div>
      ) : null}
    </div>
  );
}
