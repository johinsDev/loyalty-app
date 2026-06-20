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
  BookOpen,
  Cake,
  Camera,
  Check,
  Clock,
  Coins,
  Delete,
  Gift,
  Lock,
  LogOut,
  Minus,
  Phone,
  Plus,
  QrCode,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useRouter } from "@/i18n/navigation";

import {
  activePromos,
  type CashierError,
  categories,
  claimableRewards,
  DAILY_CAP,
  STAMPS_TODAY,
  attachedReward as REWARD,
  cashier,
  foundCustomer as CUST,
  lockedRewards,
  manager,
  memberDetail,
  memberPurchases,
  type Product,
  products,
  recentMoves,
  store,
} from "../data";

type Screen =
  | "earn-identify"
  | "earn-phone"
  | "earn-found"
  | "earn-success"
  | "redeem-scan"
  | "redeem-detail"
  | "redeem-success";

const GRAD = "bg-gradient-to-br from-primary to-primary/80";

/**
 * Cashier register (POS-lite) for the shared tablet — a faithful build of the
 * "T4 Caja" design on our tokens + lucide. Two-pane on desktop, stacks on
 * tablet/phone. Design-first/hardcoded (see ../data); wires to the real ledger
 * (sellos.add / redemptions.confirm) in Phase A. Amount-based tiers add an
 * optional `monto` field — gate it with `amountTiers` once org config exists.
 */
export function CajaView({ amountTiers = false }: { amountTiers?: boolean }) {
  const t = useTranslations("Cashier");
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("earn-identify");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [phone, setPhone] = useState("");
  const [sellosBase, setSellosBase] = useState(STAMPS_TODAY);
  const [lastStamps, setLastStamps] = useState(0);
  const [error, setError] = useState<CashierError | null>(null);
  const [mgrOpen, setMgrOpen] = useState(false);
  const [mgrPin, setMgrPin] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const capReached = sellosBase >= DAILY_CAP;
  const totalStamps = useMemo(
    () =>
      products.reduce((sum, p) => sum + (cart[p.id] ?? 0) * p.earns, 0),
    [cart],
  );
  const isEarn = screen.startsWith("earn");
  const isRedeem = screen.startsWith("redeem");
  const enough = CUST.stamps >= REWARD.cost;
  const phoneValid = isValidE164Phone(phone);

  const addProduct = (id: string) =>
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const incProduct = (id: string) =>
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const decProduct = (id: string) =>
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) };
      if (next[id] === 0) delete next[id];
      return next;
    });

  const confirmEarn = () => {
    if (sellosBase + totalStamps > DAILY_CAP) {
      setError("cap");
      return;
    }
    setLastStamps(totalStamps);
    setSellosBase((s) => s + totalStamps);
    setScreen("earn-success");
  };

  const resetToIdentify = () => {
    setScreen("earn-identify");
    setCart({});
    setPhone("");
  };

  const pressMgr = (n: string) => {
    const pin = (mgrPin + n).slice(0, 4);
    setMgrPin(pin);
    if (pin.length === 4) {
      setTimeout(() => {
        setMgrOpen(false);
        setMgrPin("");
        setScreen("redeem-success");
      }, 200);
    }
  };

  const newStamps = Math.min(CUST.stampGoal, CUST.stamps + lastStamps);
  const toGoal = Math.max(0, CUST.stampGoal - newStamps);
  const nudge =
    toGoal === 0
      ? t("nudgeComplete")
      : t("nudgeToGo", { count: toGoal });

  return (
    <div className="bg-muted/40 text-foreground relative flex h-screen flex-col overflow-hidden">
      <style>{`@keyframes t4scan{0%{top:14%}50%{top:80%}100%{top:14%}}@keyframes t4confetti{0%{transform:translateY(-12%) rotate(0);opacity:0}8%{opacity:1}100%{transform:translateY(110vh) rotate(680deg);opacity:0}}`}</style>

      {/* ===== STAFF / SHIFT BAR ===== */}
      <header className="bg-card border-border flex flex-none flex-wrap items-center gap-4 border-b px-6 py-3.5 pr-28">
        <div className="flex items-center gap-3">
          <span
            className={`font-display grid size-10 flex-none place-items-center rounded-xl text-base font-semibold text-white ${GRAD}`}
          >
            T4
          </span>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">
              {t("registerAt", { store: store.name })}
            </div>
            <div className="text-muted-foreground/70 text-xs font-semibold">
              {store.shift}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="bg-muted flex items-center gap-3 rounded-xl px-3.5 py-2">
          <TrendingUp className="text-muted-foreground size-5" />
          <div className="leading-tight">
            <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
              {t("stampsToday")}
            </div>
            <div
              className={`text-sm font-extrabold ${capReached ? "text-amber-600" : "text-foreground"}`}
            >
              {sellosBase}{" "}
              <span className="text-muted-foreground/70 font-bold">
                / {DAILY_CAP}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-muted flex items-center gap-2.5 rounded-xl py-1.5 pr-1.5 pl-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-extrabold whitespace-nowrap">
              {cashier.name}
            </div>
            <button
              type="button"
              onClick={() => setSwitchOpen(true)}
              className="text-primary text-xs font-extrabold whitespace-nowrap"
            >
              {t("switchCashier")}
            </button>
          </div>
          <span
            className={`grid size-9 flex-none place-items-center rounded-full text-xs font-extrabold text-white ${GRAD}`}
          >
            {cashier.initials}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="border-border bg-card text-muted-foreground hover:text-foreground flex h-10 flex-none items-center gap-1.5 rounded-xl border px-3 text-sm font-bold"
        >
          <BookOpen className="size-4" />
          <span className="hidden sm:inline">{t("viewMenu")}</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label={t("exit")}
          className="border-border bg-card text-muted-foreground hover:text-foreground flex h-10 flex-none items-center gap-1.5 rounded-xl border px-3 text-sm font-bold"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">{t("exit")}</span>
        </button>
      </header>

      {capReached ? (
        <div className="flex flex-none items-center gap-2.5 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2.5 text-sm font-bold text-amber-600">
          <AlertTriangle className="size-4" />
          {t("capBanner")}
        </div>
      ) : null}

      {/* ===== BODY ===== */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {(screen === "earn-identify" ||
            screen === "earn-phone" ||
            screen === "redeem-scan") && (
            <div className="bg-muted mb-6 flex max-w-md gap-1.5 rounded-2xl p-1.5">
              <ModeButton
                active={isEarn}
                onClick={resetToIdentify}
                icon={<Plus className="size-5" />}
                label={t("modeEarn")}
              />
              <ModeButton
                active={isRedeem}
                onClick={() => setScreen("redeem-scan")}
                icon={<Gift className="size-5" />}
                label={t("modeRedeem")}
              />
            </div>
          )}

          {/* ---- IDENTIFY ---- */}
          {screen === "earn-identify" && (
            <div className="flex flex-wrap items-stretch gap-5">
              <Card className="flex min-w-80 flex-1 basis-96 flex-col p-6">
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  {t("identifyTitle")}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("identifyHint")}
                </p>
                <ScanFrame caption={t("aimCamera")} />
                <BigButton
                  onClick={() => setScreen("earn-found")}
                  icon={<QrCode className="size-6" />}
                >
                  {t("scanMemberQr")}
                </BigButton>
                <button
                  type="button"
                  onClick={() => {
                    setPhone("");
                    setScreen("earn-phone");
                  }}
                  className="border-border bg-card text-foreground mt-2.5 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border text-base font-bold"
                >
                  <Phone className="size-5" />
                  {t("enterPhone")}
                </button>
              </Card>

              <Card className="flex min-w-72 flex-1 basis-80 flex-col p-5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider">
                    {t("recentMoves")}
                  </span>
                  <span className="text-muted-foreground/70 text-xs font-semibold">
                    {t("today")}
                  </span>
                </div>
                {recentMoves.map((r) => (
                  <div
                    key={r.id}
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
                    <div className="text-right">
                      <div
                        className={`text-sm font-extrabold ${r.kind === "redeem" ? "text-muted-foreground" : "text-primary"}`}
                      >
                        {r.amount}
                      </div>
                      <div className="text-muted-foreground/70 text-xs font-semibold">
                        {r.time}
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* ---- PHONE ---- */}
          {screen === "earn-phone" && (
            <Card className="mx-auto max-w-md p-6">
              <button
                type="button"
                onClick={resetToIdentify}
                className="text-muted-foreground mb-3.5 flex items-center gap-1 text-sm font-bold"
              >
                <ArrowLeft className="size-4" />
                {t("back")}
              </button>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {t("phoneTitle")}
              </h2>
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
              <BigButton
                onClick={() => setError("notfound")}
                disabled={!phoneValid}
              >
                {t("searchMember")}
              </BigButton>
            </Card>
          )}

          {/* ---- FOUND (register) ---- */}
          {screen === "earn-found" && (
            <div className="flex flex-wrap items-start gap-5">
              {/* customer */}
              <div className="flex min-w-72 flex-1 basis-80 flex-col gap-4">
                <Card className="p-5">
                  <div className="flex items-center gap-3.5">
                    <span
                      className="font-display grid size-15 flex-none place-items-center rounded-full text-2xl font-semibold text-amber-900"
                      style={{
                        backgroundImage:
                          "linear-gradient(150deg,#ffd0ad,#ff9d6e)",
                      }}
                    >
                      {CUST.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-extrabold">
                        {CUST.name}
                      </div>
                      <div className="text-muted-foreground text-sm font-semibold">
                        {CUST.phone}
                      </div>
                      <span className="bg-muted mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold">
                        {CUST.tierEmoji} {CUST.tier}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailOpen(true)}
                      className="border-border bg-card text-muted-foreground hover:text-foreground flex-none rounded-full border px-3 py-1.5 text-xs font-bold"
                    >
                      {t("viewDetail")}
                    </button>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <div className="bg-muted flex-1 rounded-2xl p-3.5">
                      <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                        {t("stamps")}
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="font-display text-3xl font-semibold">
                          {CUST.stamps}
                        </span>
                        <span className="text-muted-foreground/70 text-sm font-bold">
                          / {CUST.stampGoal}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Array.from({ length: CUST.stampGoal }).map((_, i) => (
                          <span
                            key={i}
                            className={`size-3.5 rounded-full border ${i < CUST.stamps ? "bg-primary border-primary" : "border-border"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="bg-muted flex-1 rounded-2xl p-3.5">
                      <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                        {t("points")}
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="font-display text-primary text-3xl font-semibold">
                          {CUST.points}
                        </span>
                        <span className="text-muted-foreground/70 text-sm font-bold">
                          pts
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-2 text-xs font-semibold">
                        {CUST.toNext}
                      </div>
                    </div>
                  </div>
                </Card>

                {amountTiers ? (
                  <Card className="p-5">
                    <div className="text-muted-foreground/70 mb-2 text-[0.6875rem] font-extrabold tracking-wider">
                      {t("purchaseAmount")}
                    </div>
                    <div className="border-border bg-muted flex h-14 items-center gap-2 rounded-2xl border px-4">
                      <span className="text-muted-foreground/70 text-lg font-extrabold">
                        $
                      </span>
                      <span className="font-display text-xl font-semibold">
                        42.00
                      </span>
                    </div>
                  </Card>
                ) : null}

                <button
                  type="button"
                  onClick={resetToIdentify}
                  className="text-muted-foreground flex items-center gap-1.5 self-start py-1.5 text-sm font-bold"
                >
                  <X className="size-4" />
                  {t("cancelIdentify")}
                </button>
              </div>

              {/* products */}
              <Card className="min-w-80 flex-1 basis-96 p-5">
                <div className="mb-3.5 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">
                    {t("markProducts")}
                  </h3>
                  <span className="text-muted-foreground/70 text-xs font-bold">
                    {t("noPrices")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {products.map((p) => {
                    const qty = cart[p.id] ?? 0;
                    const sel = qty > 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p.id)}
                        className={`flex flex-col gap-2.5 rounded-2xl border p-3.5 text-left transition-colors ${sel ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="bg-muted grid size-10 place-items-center rounded-xl text-xl">
                            {p.emoji}
                          </span>
                          <span className="bg-primary/10 text-primary rounded-full px-2 py-1 text-[0.6875rem] font-extrabold">
                            +{p.earns} {p.earns === 1 ? t("stampOne") : t("stampMany")}
                          </span>
                        </div>
                        <div className="text-sm leading-tight font-bold">
                          {p.name}
                        </div>
                        {sel ? (
                          <div className="flex items-center justify-between">
                            <Stepper
                              onClick={(e) => {
                                e.stopPropagation();
                                decProduct(p.id);
                              }}
                              icon={<Minus className="size-4" />}
                            />
                            <span className="text-base font-extrabold">
                              {qty}
                            </span>
                            <Stepper
                              onClick={(e) => {
                                e.stopPropagation();
                                incProduct(p.id);
                              }}
                              icon={<Plus className="size-4" />}
                            />
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ===== STICKY CONFIRM ===== */}
      {screen === "earn-found" ? (
        <div className="bg-card border-border flex-none border-t px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                {t("willAward")}
              </span>
              <span className="font-display text-primary text-2xl font-semibold">
                +{totalStamps}
              </span>
              <span className="text-muted-foreground text-sm font-bold">
                {totalStamps === 1 ? t("stampOne") : t("stampMany")}
              </span>
            </div>
            <Button
              type="button"
              variant="gradient"
              size="lg"
              onClick={confirmEarn}
              disabled={totalStamps === 0 || capReached}
              className="h-14 w-full gap-2.5 rounded-2xl text-base font-extrabold whitespace-nowrap sm:w-auto sm:px-10"
            >
              <Check className="size-5" />
              {t("confirmEarn", { count: totalStamps })}
            </Button>
          </div>
        </div>
      ) : null}

      {/* ===== EARN SUCCESS ===== */}
      {screen === "earn-success" ? (
        <div className="bg-background absolute inset-0 z-40 flex items-center justify-center overflow-y-auto p-8">
          <Confetti />
          <div className="relative mx-auto flex max-w-md flex-col items-center gap-3.5 text-center">
            <div
              className={`grid size-28 place-items-center rounded-3xl text-white shadow-xl ${GRAD}`}
            >
              <Check className="size-14" strokeWidth={3} />
            </div>
            <div className="font-display text-5xl font-semibold tracking-tight">
              +{lastStamps} {t("stampMany")}
            </div>
            <div className="text-muted-foreground text-lg">
              {t("forCustomer")}{" "}
              <strong className="text-foreground">{CUST.name}</strong>
            </div>
            <Card className="mt-2 flex items-center gap-4 p-4">
              <div className="text-left">
                <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                  {t("newBalance")}
                </div>
                <div className="text-xl font-extrabold">
                  {newStamps}
                  <span className="text-muted-foreground/70 font-bold">
                    /{CUST.stampGoal}
                  </span>{" "}
                  {t("stampMany")}
                </div>
              </div>
              <div className="bg-border h-9 w-px" />
              <div className="text-left">
                <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                  {t("points")}
                </div>
                <div className="text-primary text-xl font-extrabold">
                  {CUST.points + lastStamps * 8}
                </div>
              </div>
            </Card>
            <div className="bg-primary/10 text-primary mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold">
              🎯 {nudge}
            </div>
            <BigButton
              onClick={resetToIdentify}
              className="mt-3 max-w-xs"
            >
              {t("nextMember")}
            </BigButton>
          </div>
        </div>
      ) : null}

      {/* ===== REDEEM OVERLAY ===== */}
      {isRedeem ? (
        <div className="bg-background absolute inset-0 z-40 flex flex-col">
          <div className="bg-card border-border flex flex-none items-center gap-3.5 border-b px-6 py-4">
            <button
              type="button"
              onClick={resetToIdentify}
              className="border-border bg-card text-foreground grid size-10 place-items-center rounded-xl border"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="font-display text-lg font-semibold">
              {t("validateRedeem")}
            </div>
          </div>

          <div className="scrollbar-thin flex flex-1 items-start justify-center overflow-y-auto p-6">
            <div className="w-full max-w-xl">
              {screen === "redeem-scan" && (
                <Card className="mx-auto max-w-md p-6">
                  <h2 className="font-display text-2xl font-semibold tracking-tight">
                    {t("scanRedeemTitle")}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t("scanRedeemHint")}
                  </p>
                  <ScanFrame />
                  <BigButton onClick={() => setScreen("redeem-detail")}>
                    {t("scanRedeemCode")}
                  </BigButton>
                </Card>
              )}

              {screen === "redeem-detail" && (
                <Card className="mx-auto max-w-md p-6">
                  <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide">
                    <Check className="size-4" />
                    {t("codeValid")}
                  </span>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="bg-muted grid size-18 flex-none place-items-center rounded-2xl text-4xl">
                      {REWARD.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-2xl leading-tight font-semibold tracking-tight">
                        {REWARD.name}
                      </div>
                      <div className="text-muted-foreground mt-1 text-sm">
                        {REWARD.desc}
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted mt-5 flex items-center justify-between rounded-2xl p-4">
                    <div>
                      <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                        {t("cost")}
                      </div>
                      <div className="text-xl font-extrabold">
                        {REWARD.cost} {t("stampMany")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                        {t("memberBalance")}
                      </div>
                      <div
                        className={`text-xl font-extrabold ${enough ? "text-foreground" : "text-rose-500"}`}
                      >
                        {CUST.stamps} {t("stampMany")}
                      </div>
                    </div>
                  </div>
                  {enough ? (
                    <BigButton
                      onClick={() => {
                        setMgrPin("");
                        setMgrOpen(true);
                      }}
                      className="mt-5"
                    >
                      {t("confirmRedeem")}
                    </BigButton>
                  ) : (
                    <>
                      <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-rose-500/10 px-4 py-3.5 text-sm font-bold text-rose-500">
                        <AlertTriangle className="size-4" />
                        {t("insufficientShort", {
                          count: REWARD.cost - CUST.stamps,
                        })}
                      </div>
                      <BigButton disabled className="mt-3">
                        {t("confirmRedeem")}
                      </BigButton>
                    </>
                  )}
                </Card>
              )}

              {screen === "redeem-success" && (
                <div className="mx-auto mt-5 flex max-w-md flex-col items-center gap-3.5 text-center">
                  <div
                    className={`grid size-28 place-items-center rounded-3xl text-white shadow-xl ${GRAD}`}
                  >
                    <Check className="size-14" strokeWidth={3} />
                  </div>
                  <div className="font-display text-4xl font-semibold tracking-tight">
                    {t("redeemValidated")}
                  </div>
                  <div className="text-muted-foreground text-base">
                    {t("handReward")}{" "}
                    <strong className="text-foreground">{REWARD.name}</strong>{" "}
                    {t("toCustomer", { name: CUST.name })}
                  </div>
                  <Card className="p-3.5 px-5 text-sm">
                    <span className="text-muted-foreground/70 font-bold">
                      {t("remainingBalance")}
                    </span>{" "}
                    <strong>
                      {Math.max(0, CUST.stamps - REWARD.cost)} {t("stampMany")}
                    </strong>{" "}
                    · {t("approvedBy", { name: manager.name })}
                  </Card>
                  <BigButton
                    onClick={resetToIdentify}
                    className="mt-2.5 max-w-xs"
                  >
                    {t("done")}
                  </BigButton>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== MANAGER OVERRIDE SHEET ===== */}
      {mgrOpen ? (
        <>
          <div
            className="absolute inset-0 z-50 bg-black/50"
            onClick={() => setMgrOpen(false)}
          />
          <div className="bg-card absolute inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl px-6 pt-4 pb-7 shadow-2xl">
            <div className="bg-border mx-auto mb-4 h-1.5 w-11 rounded-full" />
            <div className="mb-3.5 text-center">
              <div className="text-xs font-extrabold tracking-wider text-amber-600">
                {t("approvalRequired")}
              </div>
              <div className="font-display mt-0.5 text-2xl font-semibold">
                {t("supervisorPin")}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                {t("supervisorPinHint")}
              </div>
            </div>
            <div className="flex justify-center gap-3.5 py-3">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`size-4 rounded-full border-2 ${i < mgrPin.length ? "bg-primary border-primary" : "border-border"}`}
                />
              ))}
            </div>
            <Keypad onPress={pressMgr} onBack={() => setMgrPin((p) => p.slice(0, -1))} />
          </div>
        </>
      ) : null}

      {/* ===== MEMBER DETAIL (verify birthday / see promos + rewards) ===== */}
      <ResponsiveModal open={detailOpen} onOpenChange={setDetailOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex max-h-[80dvh] flex-col gap-4 overflow-y-auto px-6 pt-2 pb-6">
            <div className="flex items-center gap-3.5">
              <span
                className="font-display grid size-14 flex-none place-items-center rounded-full text-xl font-semibold text-amber-900"
                style={{ backgroundImage: "linear-gradient(150deg,#ffd0ad,#ff9d6e)" }}
              >
                {CUST.initials}
              </span>
              <div className="min-w-0">
                <ResponsiveModalTitle className="text-lg font-extrabold">
                  {CUST.name}
                </ResponsiveModalTitle>
                <ResponsiveModalDescription className="text-muted-foreground text-sm font-semibold">
                  {CUST.phone} · {CUST.tierEmoji} {CUST.tier}
                </ResponsiveModalDescription>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <InfoTile icon={<Cake className="size-4" />} label={t("birthday")} value={memberDetail.birthday} />
              <InfoTile label={t("memberSince")} value={memberDetail.memberSince} />
              <InfoTile label={t("email")} value={memberDetail.email} />
              <InfoTile label={t("visits")} value={`${memberDetail.visits}`} />
            </div>

            <DetailSection title={t("promosActive")}>
              {activePromos.map((p) => (
                <DetailRow key={p.name} emoji={p.emoji} name={p.name} note={p.detail} />
              ))}
            </DetailSection>

            <DetailSection title={t("rewardsClaimable")}>
              {claimableRewards.map((r) => (
                <DetailRow
                  key={r.name}
                  emoji={r.emoji}
                  name={r.name}
                  note={t("costStamps", { count: r.cost }) + " · " + t("rewardReady")}
                />
              ))}
            </DetailSection>

            <DetailSection title={t("rewardsLocked")}>
              {lockedRewards.map((r) => (
                <DetailRow
                  key={r.name}
                  emoji={r.emoji}
                  name={r.name}
                  note={t("costStamps", { count: r.cost })}
                  locked
                />
              ))}
            </DetailSection>

            <DetailSection title={t("purchaseHistory")}>
              {memberPurchases.map((h) => (
                <div
                  key={h.id}
                  className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3"
                >
                  <span className="bg-muted grid size-9 flex-none place-items-center rounded-xl text-lg">
                    🧾
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
            </DetailSection>

            <ResponsiveModalClose
              variant="secondary"
              className="h-14 w-full rounded-2xl text-base"
            >
              {t("close")}
            </ResponsiveModalClose>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ===== SWITCH CASHIER (confirm → re-login) ===== */}
      <ResponsiveModal open={switchOpen} onOpenChange={setSwitchOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex flex-col items-center px-6 pt-2 pb-6 text-center">
            <span className="bg-muted mb-4 grid size-20 place-items-center rounded-3xl">
              <LogOut className="size-9" />
            </span>
            <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
              {t("switchTitle")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {t("switchBody")}
            </ResponsiveModalDescription>
            <BigButton
              onClick={() => router.push("/sign-in")}
              className="mt-6"
            >
              {t("switchConfirm")}
            </BigButton>
            <ResponsiveModalClose
              variant="secondary"
              className="mt-2 h-14 w-full rounded-2xl text-base"
            >
              {t("cancel")}
            </ResponsiveModalClose>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ===== CATALOG (menu browser) ===== */}
      <CatalogModal open={catalogOpen} onOpenChange={setCatalogOpen} />

      {/* ===== ERROR / EMPTY STATES (responsive modal) ===== */}
      <ErrorModal errKey={error} onClose={() => setError(null)} />
    </div>
  );
}

/* ---------------- small building blocks ---------------- */

function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-card border-border rounded-3xl border shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/** POS primary action — the @loyalty/ui Button at register scale. */
function BigButton({
  onClick,
  disabled,
  icon,
  variant = "gradient",
  className = "",
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className={`h-16 w-full gap-3 rounded-2xl text-lg font-extrabold ${className}`}
    >
      {icon}
      {children}
    </Button>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-13 flex-1 items-center justify-center gap-2.5 rounded-2xl text-base font-bold transition-colors ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Stepper({
  onClick,
  icon,
}: {
  onClick: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border bg-card text-foreground grid size-9 place-items-center rounded-xl border"
    >
      {icon}
    </button>
  );
}

/**
 * Read-only menu browser the cashier can open any time: search by name, filter
 * by category, and tap a product to see its detail. Same catalog the earn
 * picker marks from; here it's just to look things up.
 */
function CatalogModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Cashier");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  const reset = () => {
    setSelected(null);
    setQuery("");
    setCat(null);
  };
  const filtered = products.filter(
    (p) =>
      (!cat || p.category === cat) &&
      p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        {selected ? (
          <div className="flex flex-col px-6 pt-2 pb-6">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-muted-foreground mb-3 flex items-center gap-1 self-start text-sm font-bold"
            >
              <ArrowLeft className="size-4" />
              {t("back")}
            </button>
            <span className="bg-muted mb-3 grid size-20 place-items-center rounded-3xl text-4xl">
              {selected.emoji}
            </span>
            <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
              {selected.name}
            </ResponsiveModalTitle>
            <div className="mt-2 flex items-center gap-2">
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-bold">
                {selected.category}
              </span>
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-extrabold">
                +{selected.earns}{" "}
                {selected.earns === 1 ? t("stampOne") : t("stampMany")}
              </span>
            </div>
            <ResponsiveModalDescription className="text-foreground mt-3 text-sm leading-relaxed">
              {selected.description}
            </ResponsiveModalDescription>
          </div>
        ) : (
          <div className="flex max-h-[78dvh] flex-col px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
              {t("menuTitle")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="sr-only">
              {t("menuTitle")}
            </ResponsiveModalDescription>
            <div className="border-border bg-muted mt-3 flex h-12 flex-none items-center gap-2 rounded-2xl border px-4">
              <Search className="text-muted-foreground/70 size-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("menuSearch")}
                className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm font-semibold outline-none"
              />
            </div>
            <div className="scrollbar-hide -mx-1 mt-3 flex flex-none gap-2 overflow-x-auto px-1 pb-1">
              <Chip active={cat === null} onClick={() => setCat(null)}>
                {t("all")}
              </Chip>
              {categories.map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                  {c}
                </Chip>
              ))}
            </div>
            <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  {t("menuEmpty")}
                </p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3 text-left"
                  >
                    <span className="bg-muted grid size-10 flex-none place-items-center rounded-xl text-xl">
                      {p.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{p.name}</div>
                      <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                        {p.description}
                      </div>
                    </div>
                    <span className="bg-primary/10 text-primary flex-none rounded-full px-2 py-1 text-[0.6875rem] font-extrabold">
                      +{p.earns}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 flex-none rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors ${active ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border"}`}
    >
      {children}
    </button>
  );
}

function InfoTile({
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

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground/70 mb-2 text-[0.6875rem] font-extrabold tracking-wider">
        {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function DetailRow({
  emoji,
  name,
  note,
  locked,
}: {
  emoji: string;
  name: string;
  note: string;
  locked?: boolean;
}) {
  return (
    <div
      className={`border-border bg-card flex items-center gap-3 rounded-2xl border p-3 ${locked ? "opacity-60" : ""}`}
    >
      <span className="bg-muted grid size-9 flex-none place-items-center rounded-xl text-lg">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{name}</div>
        <div className="text-muted-foreground/70 text-xs font-semibold">
          {note}
        </div>
      </div>
      {locked ? <Lock className="text-muted-foreground/70 size-4 flex-none" /> : null}
    </div>
  );
}

function ScanFrame({ caption }: { caption?: string }) {
  return (
    <div
      className="relative my-5 flex h-56 items-center justify-center overflow-hidden rounded-3xl"
      style={{ background: "#0a1626" }}
    >
      <div className="relative aspect-square w-1/2">
        {["top-0 left-0 rounded-tl-lg border-t-4 border-l-4", "top-0 right-0 rounded-tr-lg border-t-4 border-r-4", "bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4", "bottom-0 right-0 rounded-br-lg border-b-4 border-r-4"].map(
          (c) => (
            <span
              key={c}
              className={`border-primary absolute size-8 ${c}`}
            />
          ),
        )}
        <span
          className="via-primary absolute inset-x-3 h-0.5 rounded bg-gradient-to-r from-transparent to-transparent"
          style={{ animation: "t4scan 2.6s ease-in-out infinite", top: "14%" }}
        />
      </div>
      {caption ? (
        <div className="absolute inset-x-0 bottom-3.5 text-center text-xs font-semibold text-white/80">
          {caption}
        </div>
      ) : null}
    </div>
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
        <KeyButton key={n} onClick={() => onPress(n)}>
          {n}
        </KeyButton>
      ))}
      <span />
      <KeyButton onClick={() => onPress("0")}>0</KeyButton>
      <KeyButton ghost onClick={onBack}>
        <Delete className="size-5" />
      </KeyButton>
    </div>
  );
}

function KeyButton({
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
      className={`font-display grid h-15 place-items-center rounded-2xl text-2xl font-semibold transition-transform active:scale-95 ${ghost ? "text-muted-foreground" : "border-border bg-card text-foreground border"}`}
    >
      {children}
    </button>
  );
}

function Confetti() {
  const colors = ["#1BAD9D", "#5fe0c8", "#ffd36e", "#ff8fa3", "#8ad9ff"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 32 }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 block w-2 rounded-sm"
          style={{
            left: `${(i * 53) % 100}%`,
            height: `${10 + (i % 4) * 4}px`,
            background: colors[i % colors.length],
            animation: `t4confetti ${(2.4 + (i % 5) * 0.4).toFixed(2)}s linear ${((i % 7) * 0.15).toFixed(2)}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

const ERROR_CONFIG: Record<
  CashierError,
  { icon: React.ReactNode; tint: string; sec: boolean }
> = {
  notfound: { icon: <Search className="size-9" />, tint: "bg-muted", sec: true },
  insufficient: { icon: <Coins className="size-9" />, tint: "bg-rose-500/15 text-rose-500", sec: false },
  cap: { icon: <AlertTriangle className="size-9" />, tint: "bg-amber-500/15 text-amber-600", sec: true },
  expired: { icon: <Clock className="size-9" />, tint: "bg-rose-500/15 text-rose-500", sec: true },
  camera: { icon: <Camera className="size-9" />, tint: "bg-muted", sec: true },
};

/**
 * Error / empty states surfaced as a {@link ResponsiveModal} (bottom sheet on
 * tablet/phone, centered dialog on desktop) — they appear when the situation
 * actually occurs in the flow (cap on confirm, not-found on phone search,
 * expired on a manual code, camera on a blocked scanner), not from a dev rail.
 */
function ErrorModal({
  errKey,
  onClose,
}: {
  errKey: CashierError | null;
  onClose: () => void;
}) {
  const t = useTranslations("Cashier");
  const c = errKey ? ERROR_CONFIG[errKey] : null;
  return (
    <ResponsiveModal open={errKey !== null} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        {errKey && c ? (
          <div className="flex flex-col items-center px-6 pt-2 pb-6 text-center">
            <span
              className={`mb-4 grid size-20 place-items-center rounded-3xl ${c.tint}`}
            >
              {c.icon}
            </span>
            <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
              {t(`err.${errKey}.title`)}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {t(`err.${errKey}.body`)}
            </ResponsiveModalDescription>
            <ResponsiveModalClose
              variant="gradient"
              className="mt-6 h-14 w-full rounded-2xl text-base"
            >
              {t(`err.${errKey}.cta`)}
            </ResponsiveModalClose>
            {c.sec ? (
              <ResponsiveModalClose
                variant="secondary"
                className="mt-2 h-14 w-full rounded-2xl text-base"
              >
                {t(`err.${errKey}.sec`)}
              </ResponsiveModalClose>
            ) : null}
          </div>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
