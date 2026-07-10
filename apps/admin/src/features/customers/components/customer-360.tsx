"use client";

import type { CustomerDetail, CustomerStats } from "@loyalty/api/features/customers/schemas";
import { formatDate } from "@loyalty/date";
import {
  Badge,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@loyalty/ui";
import {
  ArrowLeft,
  Ban,
  Cake,
  CalendarDays,
  Mail,
  Pencil,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useHasRole } from "@/lib/role-context";

import { customerInitials } from "../lib/initials";
import { BanCustomerDialog, UnbanCustomerDialog } from "./dialogs/ban-customer-dialog";
import { NotifyCustomerDialog } from "./dialogs/notify-customer-dialog";
import { ActivityTab } from "./tabs/activity-tab";
import { LoyaltyTab } from "./tabs/loyalty-tab";
import { OverviewTab } from "./tabs/overview-tab";
import { PurchasesTab } from "./tabs/purchases-tab";

const TABS = ["overview", "activity", "loyalty", "purchases"] as const;

/**
 * The customer 360. `detail` and `stats` are resolved by the RSC page and passed
 * as props (no client re-query) — the write dialogs call `router.refresh()` to
 * re-pull them. Each tab lazily queries its own cursor-paginated data.
 */
export function Customer360({
  detail,
  stats,
}: {
  detail: CustomerDetail;
  stats: CustomerStats;
}) {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const router = useRouter();
  const isOwner = useHasRole("owner");
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("overview"));
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);

  const displayName = detail.name || detail.phone;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Link
        href="/customers"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("backToList")}
      </Link>

      {detail.banned ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 flex items-start gap-2.5 rounded-2xl border p-4">
          <Ban className="mt-0.5 size-4 flex-none" />
          <div className="min-w-0 text-sm">
            <p className="font-bold">{t("detail.bannedTitle")}</p>
            {detail.banReason ? (
              <p className="opacity-90">{t("detail.bannedReason", { reason: detail.banReason })}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="bg-card border-border rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar detail={detail} />
              <div className="min-w-0 flex-1">
                <h1 className="font-display truncate text-xl font-semibold tracking-tight">
                  {displayName}
                </h1>
                <p className="text-muted-foreground truncate text-sm font-semibold">
                  {detail.nickname ? `@${detail.nickname}` : t("detail.noNickname")}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline">{t(`tier.${detail.tierKey ?? "hoja"}`)}</Badge>
              <Badge variant={detail.banned ? "destructive" : "default"}>
                {t(`status.${detail.banned ? "banned" : "active"}`)}
              </Badge>
            </div>

            <dl className="mt-5 space-y-3">
              <Row icon={Phone} label={t("col.phone")} value={detail.phone} />
              <Row icon={Mail} label={t("email")} value={detail.email ?? t("detail.noEmail")} />
              <Row
                icon={Cake}
                label={t("birthday")}
                value={
                  detail.birthday
                    ? formatDate(detail.birthday, { locale })
                    : t("detail.noBirthday")
                }
              />
              <Row
                icon={CalendarDays}
                label={t("joined")}
                value={formatDate(detail.createdAt, { locale })}
              />
              <Row
                icon={CalendarDays}
                label={t("detail.lastVisit")}
                value={<LastVisit days={detail.daysSinceLastVisit} />}
              />
            </dl>
          </section>

          <section className="bg-card border-border space-y-2 rounded-2xl border p-5 shadow-sm">
            <h2 className="text-muted-foreground/70 mb-3 text-xs font-extrabold tracking-wider uppercase">
              {t("detail.actions")}
            </h2>
            <Button
              className="h-10 w-full justify-start gap-2 rounded-xl font-semibold"
              onClick={() => router.push({ pathname: "/customers/[id]/edit", params: { id: detail.id } })}
            >
              <Pencil className="size-4" />
              {t("edit")}
            </Button>
            <Button
              variant="outline"
              className="h-10 w-full justify-start gap-2 rounded-xl"
              onClick={() => setNotifyOpen(true)}
            >
              <Send className="size-4" />
              {t("notify.action")}
            </Button>
            {isOwner ? (
              detail.banned ? (
                <Button
                  variant="outline"
                  className="h-10 w-full justify-start gap-2 rounded-xl"
                  onClick={() => setUnbanOpen(true)}
                >
                  <ShieldCheck className="size-4" />
                  {t("ban.unbanAction")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 h-10 w-full justify-start gap-2 rounded-xl"
                  onClick={() => setBanOpen(true)}
                >
                  <Ban className="size-4" />
                  {t("ban.action")}
                </Button>
              )
            ) : null}
          </section>
        </aside>

        <Tabs value={tab} onValueChange={(v) => void setTab(v as (typeof TABS)[number])}>
          <TabsList className="h-10">
            {TABS.map((key) => (
              <TabsTrigger key={key} value={key} className="px-4">
                {t(`tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab stats={stats} />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <ActivityTab customerId={detail.id} />
          </TabsContent>
          <TabsContent value="loyalty" className="mt-4">
            <LoyaltyTab customerId={detail.id} />
          </TabsContent>
          <TabsContent value="purchases" className="mt-4">
            <PurchasesTab customerId={detail.id} />
          </TabsContent>
        </Tabs>
      </div>

      <NotifyCustomerDialog customerId={detail.id} open={notifyOpen} onOpenChange={setNotifyOpen} />
      {isOwner ? (
        <>
          <BanCustomerDialog
            customerId={detail.id}
            name={displayName}
            open={banOpen}
            onOpenChange={setBanOpen}
          />
          <UnbanCustomerDialog
            customerId={detail.id}
            name={displayName}
            open={unbanOpen}
            onOpenChange={setUnbanOpen}
          />
        </>
      ) : null}
    </div>
  );
}

function Avatar({ detail }: { detail: CustomerDetail }) {
  const initials = customerInitials(detail.name, detail.phone);
  if (detail.avatarUrl) {
    return (
      <img src={detail.avatarUrl} alt="" className="size-14 flex-none rounded-2xl object-cover" />
    );
  }
  return (
    <span className="bg-primary/10 text-primary font-display grid size-14 flex-none place-items-center rounded-2xl text-lg font-bold">
      {initials}
    </span>
  );
}

function LastVisit({ days }: { days: number | null }) {
  const t = useTranslations("Customers");
  if (days == null) return <>{t("detail.neverVisited")}</>;
  if (days === 0) return <>{t("detail.today")}</>;
  return <>{t("detail.daysAgo", { n: days })}</>;
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-muted text-muted-foreground grid size-9 flex-none place-items-center rounded-xl">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
          {label}
        </dt>
        <dd className="truncate text-sm font-bold">{value}</dd>
      </div>
    </div>
  );
}
