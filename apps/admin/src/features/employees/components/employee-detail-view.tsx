"use client";

import { authClient } from "@loyalty/auth/client";
import type { AppRouter } from "@loyalty/api";
import { Badge, Button, Skeleton } from "@loyalty/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { useQuery } from "@tanstack/react-query";
import {
  Gift,
  Mail,
  Pencil,
  Phone,
  ShoppingBag,
  Sparkles,
  Star,
  Stamp,
  Store as StoreIcon,
  UserCog,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { initialsFor } from "../lib";
import { useImpersonate } from "../use-impersonate";

type EmployeeDetail = NonNullable<inferRouterOutputs<AppRouter>["employees"]["get"]>;
type EmployeeStats = inferRouterOutputs<AppRouter>["employees"]["stats"];

/**
 * Read-only employee detail — rendered as the intercepted modal (over the list)
 * and as the full `/employees/[id]` page. Shows role/status/rating, this
 * month's stats (per store + total), contact, stores, notes, and owner actions
 * (Editar / Impersonar). Mirrors the stores detail pattern.
 */
export function EmployeeDetailView({
  detail,
  variant = "page",
}: {
  detail: EmployeeDetail;
  variant?: "page" | "modal";
}) {
  const t = useTranslations("Employees");
  const router = useRouter();
  const trpc = useTRPC();
  const { impersonate } = useImpersonate();

  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;
  const isOwner = (session?.user as { role?: string } | undefined)?.role === "admin";

  const { data: stats } = useQuery(
    trpc.employees.stats.queryOptions({ memberId: detail.memberId }),
  );

  const isSelf = currentUserId === detail.userId;

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="bg-primary/10 text-primary grid size-12 flex-none place-items-center rounded-full text-sm font-bold">
          {initialsFor(detail)}
        </span>
        <div className="min-w-0">
          <h2 className="font-display truncate text-xl font-semibold tracking-tight">
            {detail.name || detail.email || "—"}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{t(`role.${detail.role}`)}</Badge>
            <Badge
              variant="secondary"
              className={
                detail.status === "active"
                  ? "text-emerald-600"
                  : detail.status === "invited"
                    ? "text-amber-600"
                    : "text-muted-foreground"
              }
            >
              {t(`status.${detail.status}`)}
            </Badge>
            {detail.rating ? (
              <span className="inline-flex items-center gap-1 text-sm font-bold">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {detail.rating}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {isOwner && !isSelf ? (
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 rounded-xl"
            onClick={() => void impersonate(detail.userId)}
          >
            <UserCog className="size-4" />
            {t("detail.impersonate")}
          </Button>
        ) : null}
        {isOwner && !isSelf && detail.role !== "owner" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 rounded-xl"
            onClick={() =>
              router.push({ pathname: "/employees/[id]/edit", params: { id: detail.memberId } })
            }
          >
            <Pencil className="size-4" />
            {t("detail.edit")}
          </Button>
        ) : null}
      </div>
    </div>
  );

  const statsBlock = (
    <section className="space-y-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
        <Sparkles className="size-3.5" />
        {t("detail.monthStats")}
      </p>
      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric icon={ShoppingBag} label={t("detail.sales")} value={stats.total.sales} />
            <Metric icon={Stamp} label={t("detail.stamps")} value={stats.total.stamps} />
            <Metric icon={Gift} label={t("detail.rewards")} value={stats.total.redemptions} />
            <Metric icon={Sparkles} label={t("detail.points")} value={stats.total.pointsAwarded} />
          </div>
          {stats.perStore.length > 1 ? (
            <StorePerStore stats={stats} t={t} />
          ) : null}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}
    </section>
  );

  const contactBlock = (
    <section className="space-y-2">
      <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
        {t("detail.contact")}
      </p>
      <div className="space-y-1.5 text-sm">
        <p className="flex items-center gap-2">
          <Mail className="text-muted-foreground size-4" />
          {detail.email ?? "—"}
        </p>
        <p className="flex items-center gap-2">
          <Phone className="text-muted-foreground size-4" />
          {detail.phone ?? "—"}
        </p>
      </div>
    </section>
  );

  const storesBlock = (
    <section className="space-y-2">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
        <StoreIcon className="size-3.5" />
        {t("col.stores")}
      </p>
      {detail.stores.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("detail.noStores")}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {detail.stores.map((s) => (
            <Badge key={s.id} variant="outline">
              {s.name}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );

  const notesBlock = detail.notes ? (
    <section className="space-y-2">
      <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
        {t("field.notes")}
      </p>
      <p className="text-sm whitespace-pre-wrap">{detail.notes}</p>
    </section>
  ) : null;

  const activityLink = (
    <Button
      variant="outline"
      className="h-10 w-full rounded-xl"
      onClick={() =>
        router.push({ pathname: "/employees/[id]/activity", params: { id: detail.memberId } })
      }
    >
      {t("detail.viewActivity")}
    </Button>
  );

  if (variant === "modal") {
    return (
      <div className="max-h-[85dvh] space-y-5 overflow-y-auto p-5">
        {header}
        {statsBlock}
        {contactBlock}
        {storesBlock}
        {notesBlock}
        {activityLink}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {statsBlock}
          {storesBlock}
          {notesBlock}
        </div>
        <div className="bg-card border-border h-fit space-y-5 rounded-3xl border p-5 shadow-sm">
          {contactBlock}
          <div className="border-border border-t pt-4">{activityLink}</div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-card border-border rounded-2xl border p-4 shadow-sm">
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="font-display mt-1 text-xl font-semibold tracking-tight">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function StorePerStore({
  stats,
  t,
}: {
  stats: EmployeeStats;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="bg-card border-border divide-border divide-y rounded-2xl border text-sm">
      {stats.perStore.map((s) => (
        <div key={s.storeId} className="flex items-center justify-between px-4 py-2">
          <span className="font-medium">{s.storeName}</span>
          <span className="text-muted-foreground">
            {t("detail.perStoreLine", {
              sales: s.sales,
              stamps: s.stamps,
              rewards: s.redemptions,
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
