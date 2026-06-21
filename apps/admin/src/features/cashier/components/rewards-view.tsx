"use client";

import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFadeUp } from "@/lib/animate";

import { activePromos, claimableRewards, lockedRewards } from "../data";

type DetailItem = {
  emoji: string;
  name: string;
  meta: string;
  description: string;
  locked?: boolean;
};

/**
 * Premios tab — what's live for the member: active promos + redeemable rewards
 * + still-locked ones. Tap any item for its detail. Read-only reference;
 * redemptions are validated from the Escanear tab.
 */
export function RewardsView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const [selected, setSelected] = useState<DetailItem | null>(null);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("tabRewards")}
      </h1>

      <Section title={t("promosActive")}>
        {activePromos.map((p, i) => (
          <Item
            key={p.name}
            emoji={p.emoji}
            name={p.name}
            meta={p.detail}
            style={fade(i)}
            onClick={() =>
              setSelected({
                emoji: p.emoji,
                name: p.name,
                meta: p.detail,
                description: p.description,
              })
            }
          />
        ))}
      </Section>

      <Section title={t("rewardsClaimable")}>
        {claimableRewards.map((r, i) => (
          <Item
            key={r.name}
            emoji={r.emoji}
            name={r.name}
            meta={`${t("costStamps", { count: r.cost })} · ${t("rewardReady")}`}
            style={fade(i)}
            onClick={() =>
              setSelected({
                emoji: r.emoji,
                name: r.name,
                meta: t("costStamps", { count: r.cost }),
                description: r.description,
              })
            }
          />
        ))}
      </Section>

      <Section title={t("rewardsLocked")}>
        {lockedRewards.map((r, i) => (
          <Item
            key={r.name}
            emoji={r.emoji}
            name={r.name}
            meta={t("costStamps", { count: r.cost })}
            locked
            style={fade(i)}
            onClick={() =>
              setSelected({
                emoji: r.emoji,
                name: r.name,
                meta: t("costStamps", { count: r.cost }),
                description: r.description,
                locked: true,
              })
            }
          />
        ))}
      </Section>

      <ResponsiveModal
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          {selected ? (
            <div className="flex flex-col px-6 pt-2 pb-6">
              <span className="bg-muted mb-3 grid size-20 place-items-center rounded-3xl text-4xl">
                {selected.emoji}
              </span>
              <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
                {selected.name}
              </ResponsiveModalTitle>
              <div className="mt-2 flex items-center gap-2">
                <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-bold">
                  {selected.meta}
                </span>
                {selected.locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-extrabold text-amber-600">
                    <Lock className="size-3" />
                    {t("rewardsLockedTag")}
                  </span>
                ) : null}
              </div>
              <ResponsiveModalDescription className="text-foreground mt-3 text-sm leading-relaxed">
                {selected.description}
              </ResponsiveModalDescription>
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

function Item({
  emoji,
  name,
  meta,
  locked,
  style,
  onClick,
}: {
  emoji: string;
  name: string;
  meta: string;
  locked?: boolean;
  style?: React.CSSProperties;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5 text-left shadow-sm transition-transform active:scale-[0.99] ${locked ? "opacity-60" : ""}`}
    >
      <span className="bg-muted grid size-11 flex-none place-items-center rounded-xl text-xl">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{name}</div>
        <div className="text-muted-foreground/70 text-xs font-semibold">
          {meta}
        </div>
      </div>
      {locked ? (
        <Lock className="text-muted-foreground/70 size-4 flex-none" />
      ) : null}
    </button>
  );
}
