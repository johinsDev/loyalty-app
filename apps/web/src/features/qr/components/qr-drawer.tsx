"use client";

import { useSession } from "@loyalty/auth/client";
import { Drawer, DrawerContent, DrawerTitle } from "@loyalty/ui";
import { Copy, Sun, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";

import { type AttachableReward, attachableRewards, member } from "../data";
import { useQrDrawer } from "../hooks/use-qr-drawer";

/** Immersive dark backdrop from the design. */
const DARK_BG =
  "radial-gradient(120% 80% at 50% -10%, #18324a 0%, #0a1626 55%, #050b16 100%)";

/**
 * "Mi código" — the member QR the cashier scans, shown as a near-full-screen
 * drawer over the current screen (the background stays visible). One code always
 * earns on the purchase; attaching a reward re-encodes it to also redeem in the
 * same scan. Opened app-wide via {@link useQrDrawer} (scan CTA / FAB / sidebar).
 * "Brillo" keeps the same header + card and just flips the backdrop white for
 * a high-contrast scan (the web can't set system brightness).
 */
export function QrDrawer() {
  const t = useTranslations("Qr");
  const open = useQrDrawer((s) => s.open);
  const setOpen = useQrDrawer((s) => s.setOpen);
  const { data: session } = useSession();
  const [rewardId, setRewardId] = useState<string | null>(null);
  const [bright, setBright] = useState(false);

  const reward = attachableRewards.find((r) => r.id === rewardId) ?? null;
  const customerId = session?.user?.id ?? "guest";
  const qrValue = `T4|${customerId}${reward ? `|r:${reward.id}` : ""}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(member.number);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const iconBtn = bright
    ? "bg-neutral-100 text-neutral-700"
    : "bg-white/15 text-white";

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setBright(false);
      }}
    >
      <DrawerContent
        aria-describedby={undefined}
        className="mx-auto max-w-md border-0"
        style={{
          height: "92dvh",
          maxHeight: "92dvh",
          background: bright ? "#ffffff" : DARK_BG,
        }}
      >
        <div className="flex h-full flex-col overflow-y-auto px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className={`grid size-11 flex-none place-items-center rounded-full ${iconBtn}`}
            >
              <X className="size-5" />
            </button>
            <DrawerTitle
              className={`font-display flex-1 text-center text-xl font-semibold ${
                bright ? "text-neutral-900" : "text-white"
              }`}
            >
              {t("title")}
            </DrawerTitle>
            <button
              type="button"
              onClick={() => setBright((b) => !b)}
              aria-label={t("brightness")}
              aria-pressed={bright}
              className={`grid size-11 flex-none place-items-center rounded-full ${
                bright ? "bg-amber-300 text-neutral-900" : "bg-white/15 text-white"
              }`}
            >
              <Sun className="size-5" />
            </button>
          </div>

          <QrCard
            reward={reward}
            qrValue={qrValue}
            onClearReward={() => setRewardId(null)}
          />

          <p
            className={`mt-5 px-2 text-center text-sm leading-relaxed ${
              bright ? "text-neutral-600" : "text-white/80"
            }`}
          >
            {reward ? t("instructionWithReward") : t("instruction")}
          </p>

          <div className="mt-7">
            <p
              className={`mb-3 px-0.5 text-xs font-bold tracking-wider ${
                bright ? "text-neutral-400" : "text-white/60"
              }`}
            >
              {t("redeemHeading")}
            </p>
            <div className="scrollbar-hide -mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
              <Chip
                active={!reward}
                bright={bright}
                onClick={() => setRewardId(null)}
              >
                {t("none")}
              </Chip>
              {attachableRewards.map((r) => (
                <Chip
                  key={r.id}
                  active={reward?.id === r.id}
                  bright={bright}
                  onClick={() => setRewardId(r.id)}
                >
                  <span className="text-base">{r.emoji}</span>
                  {r.name}
                </Chip>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void copyCode()}
            className={`mt-6 flex h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold ${
              bright
                ? "border-neutral-200 bg-neutral-50 text-neutral-700"
                : "border-white/20 bg-white/5 text-white"
            }`}
          >
            <Copy className="size-4" />
            {t("manualCode")}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Always-light card (the QR must stay white for scanning) — uses neutral-* so
 *  it doesn't invert with the app theme. */
function QrCard({
  reward,
  qrValue,
  onClearReward,
}: {
  reward: AttachableReward | null;
  qrValue: string;
  onClearReward: () => void;
}) {
  const t = useTranslations("Qr");
  return (
    <div className="w-full rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary font-display grid size-12 flex-none place-items-center rounded-full text-xl font-semibold">
          {member.initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold text-neutral-900">
            {member.name}
          </p>
          <p className="text-sm text-neutral-500">
            {member.tierEmoji}{" "}
            {t("tierLine", { tier: member.tierName, points: member.points })}
          </p>
        </div>
      </div>

      {reward ? (
        <div className="border-primary/30 bg-primary/10 mt-4 flex items-center gap-3 rounded-2xl border p-3">
          <span className="text-2xl">{reward.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-primary text-xs font-extrabold tracking-wide">
              {t("attachedRedeem")}
            </p>
            <p className="text-sm font-extrabold text-neutral-900">
              {reward.name} · {t("cost", { count: reward.cost })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearReward}
            aria-label={t("none")}
            className="grid size-7 flex-none place-items-center rounded-full bg-neutral-100 text-neutral-500"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid place-items-center rounded-2xl bg-white p-3">
        <QRCodeSVG
          value={qrValue}
          size={236}
          level="M"
          marginSize={0}
          fgColor="#000323"
          bgColor="#ffffff"
        />
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs font-bold tracking-wider text-neutral-500">
          {t("memberNumber")}
        </p>
        <p className="font-display mt-1 text-2xl font-semibold tracking-widest text-neutral-900">
          {member.number}
        </p>
      </div>
    </div>
  );
}

function Chip({
  active,
  bright,
  onClick,
  children,
}: {
  active: boolean;
  bright: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls = active
    ? bright
      ? "border-neutral-900 bg-neutral-900 text-white"
      : "border-white bg-white text-neutral-900"
    : bright
      ? "border-neutral-200 bg-neutral-100 text-neutral-700"
      : "border-white/20 bg-white/10 text-white/85";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-bold whitespace-nowrap ${cls}`}
    >
      {children}
    </button>
  );
}
