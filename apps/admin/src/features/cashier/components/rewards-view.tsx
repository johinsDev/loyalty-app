"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFadeUp } from "@/lib/animate";

import { activePromos, claimableRewards, lockedRewards } from "../data";

/**
 * Premios tab — the rewards catalog as the cashier sees it: which ones a member
 * can redeem now and which are still locked. Read-only reference; redemptions
 * are validated from the Escanear tab.
 */
export function RewardsView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("tabRewards")}
      </h1>

      <Section title={t("promosActive")}>
        {activePromos.map((p, i) => (
          <RewardRow
            key={p.name}
            emoji={p.emoji}
            name={p.name}
            note={p.detail}
            style={fade(i)}
          />
        ))}
      </Section>

      <Section title={t("rewardsClaimable")}>
        {claimableRewards.map((r, i) => (
          <RewardRow
            key={r.name}
            emoji={r.emoji}
            name={r.name}
            note={`${t("costStamps", { count: r.cost })} · ${t("rewardReady")}`}
            style={fade(i)}
          />
        ))}
      </Section>

      <Section title={t("rewardsLocked")}>
        {lockedRewards.map((r, i) => (
          <RewardRow
            key={r.name}
            emoji={r.emoji}
            name={r.name}
            note={t("costStamps", { count: r.cost })}
            locked
            style={fade(i)}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="text-muted-foreground/70 mb-2.5 text-xs font-extrabold tracking-wider">
        {title}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function RewardRow({
  emoji,
  name,
  note,
  locked,
  style,
}: {
  emoji: string;
  name: string;
  note: string;
  locked?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm ${locked ? "opacity-60" : ""}`}
    >
      <span className="bg-muted grid size-11 flex-none place-items-center rounded-xl text-xl">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{name}</div>
        <div className="text-muted-foreground/70 text-xs font-semibold">
          {note}
        </div>
      </div>
      {locked ? (
        <Lock className="text-muted-foreground/70 size-4 flex-none" />
      ) : null}
    </div>
  );
}
