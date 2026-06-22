"use client";

import { Badge, Button } from "@loyalty/ui";
import {
  ArrowLeft,
  Cake,
  CalendarDays,
  Coins,
  Mail,
  Pencil,
  Stamp,
  UserRoundCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useFadeUp } from "@/lib/animate";
import { Link } from "@/i18n/navigation";

import { type CustomerDetail, tierColor } from "../data";

/**
 * Customer detail — header (identity + tier + edit/impersonate seams), a balance
 * card (stamp progress + points + LTV), basic info, and purchase / redemption
 * history. Design-first / hardcoded; `customer` is resolved server-side via
 * `getCustomer`. Edit + Impersonate are UI seams.
 */
export function CustomerDetailView({ customer: c }: { customer: CustomerDetail }) {
  const t = useTranslations("Customers");
  const fade = useFadeUp({ step: 50 });
  const pct = Math.round((c.stamps / c.stampsTarget) * 100);
  let i = 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 lg:px-8">
      <Link
        href="/customers"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" />
        {t("backToList")}
      </Link>

      {/* Header */}
      <section
        style={fade(i++)}
        className="bg-card border-border mt-4 flex flex-wrap items-center gap-4 rounded-3xl border p-6 shadow-sm"
      >
        <span className="bg-primary/10 text-primary font-display grid size-16 flex-none place-items-center rounded-2xl text-xl font-bold">
          {c.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {c.name}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tierColor[c.tier]}`}
            >
              {t(`tier.${c.tier}`)}
            </span>
            <Badge
              variant="secondary"
              className={
                c.status === "active"
                  ? "text-emerald-600"
                  : "text-muted-foreground"
              }
            >
              {t(`status.${c.status}`)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm font-semibold">
            {c.phone} · {t("visitsCount", { count: c.visits })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 gap-2 rounded-xl">
            <UserRoundCheck className="size-4" />
            {t("impersonate")}
          </Button>
          <Button className="h-10 gap-2 rounded-xl font-semibold">
            <Pencil className="size-4" />
            {t("edit")}
          </Button>
        </div>
      </section>

      {/* Balance */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          style={fade(i++)}
          className="bg-card border-border rounded-3xl border p-5 shadow-sm sm:col-span-1"
        >
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs font-extrabold tracking-wider uppercase">
            <Stamp className="size-3.5" />
            {t("stampsBalance")}
          </div>
          <div className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {c.stamps}
            <span className="text-muted-foreground text-lg">
              /{c.stampsTarget}
            </span>
          </div>
          <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
            <span
              className="from-primary to-primary/60 block h-full rounded-full bg-gradient-to-r"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-muted-foreground/70 mt-1.5 text-xs font-semibold">
            {t("stampsRemaining", { n: c.stampsTarget - c.stamps })}
          </p>
        </div>

        <Stat
          style={fade(i++)}
          icon={Coins}
          label={t("pointsBalance")}
          value={c.points.toLocaleString()}
        />
        <Stat
          style={fade(i++)}
          icon={Coins}
          label={t("lifetimeSpend")}
          value={c.spent}
        />
      </div>

      {/* Info */}
      <section
        style={fade(i++)}
        className="bg-card border-border mt-4 grid grid-cols-1 gap-4 rounded-3xl border p-6 shadow-sm sm:grid-cols-3"
      >
        <Info icon={Cake} label={t("birthday")} value={c.birthday} />
        <Info icon={Mail} label={t("email")} value={c.email} />
        <Info icon={CalendarDays} label={t("joined")} value={c.joined} />
      </section>

      {/* History */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section
          style={fade(i++)}
          className="bg-card border-border rounded-3xl border p-5 shadow-sm"
        >
          <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">
            {t("purchaseHistory")}
          </h2>
          <ul className="divide-border divide-y">
            {c.purchases.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{p.item}</div>
                  <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                    {p.store} · {p.ago}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{p.amount}</div>
                  <div className="text-primary text-xs font-extrabold">
                    +{p.points} pts
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          style={fade(i++)}
          className="bg-card border-border rounded-3xl border p-5 shadow-sm"
        >
          <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">
            {t("redemptionHistory")}
          </h2>
          <ul className="divide-border divide-y">
            {c.redemptions.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="bg-primary/10 grid size-9 flex-none place-items-center rounded-xl text-lg">
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{r.reward}</div>
                  <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                    {r.by} · {r.ago}
                  </div>
                </div>
                <span className="text-muted-foreground text-sm font-bold">
                  {r.cost}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  style,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className="bg-card border-border rounded-3xl border p-5 shadow-sm"
    >
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs font-extrabold tracking-wider uppercase">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="font-display mt-1 text-3xl font-semibold tracking-tight">
        {value}
      </div>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-muted text-muted-foreground grid size-10 flex-none place-items-center rounded-xl">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
          {label}
        </div>
        <div className="truncate text-sm font-bold">{value}</div>
      </div>
    </div>
  );
}
