"use client";

import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import {
  ArrowUpRight,
  Bell,
  Mail,
  MessageCircle,
  MessageSquare,
  Megaphone,
  Plus,
  Search,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { type FilterOption, FilterMultiSelect } from "@/components/filters";
import { useFadeUp } from "@/lib/animate";
import { useRouter } from "@/i18n/navigation";

import {
  type Campaign,
  type CampaignType,
  campaignKpis,
  campaigns,
  type Channel,
  type Status,
} from "../data";

const STATUSES: Status[] = ["active", "paused", "draft"];
const TYPES: CampaignType[] = ["automated", "manual"];
const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};

/**
 * Campañas — KPI row + a data table (channels, trigger, sent/open/click, type)
 * with status/type filters, Quick push + New campaign, pagination-free for now.
 * Rows open the campaign wizard. Design-first / hardcoded (../data).
 */
export function CampaignsView() {
  const t = useTranslations("Campaigns");
  const router = useRouter();
  const fade = useFadeUp({ step: 35 });

  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Status[]>([...STATUSES]);
  const [types, setTypes] = useState<CampaignType[]>([...TYPES]);

  const statusOptions: FilterOption<Status>[] = [
    { value: "active", label: t("status.active"), dot: "#1f9d68" },
    { value: "paused", label: t("status.paused"), dot: "#c98a00" },
    { value: "draft", label: t("status.draft"), dot: "#9aa1ab" },
  ];
  const typeOptions: FilterOption<CampaignType>[] = [
    { value: "automated", label: t("type.automated") },
    { value: "manual", label: t("type.manual") },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (!statuses.includes(c.status)) return false;
      if (!types.includes(c.type)) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, statuses, types]);

  const clearFilters = () => {
    setQuery("");
    setStatuses([...STATUSES]);
    setTypes([...TYPES]);
  };

  let i = 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 gap-2 rounded-xl"
            onClick={() => toast.success(t("quickPushSent"))}
          >
            <Zap className="size-4" />
            {t("quickPush")}
          </Button>
          <Button
            className="h-10 gap-2 rounded-xl font-semibold"
            onClick={() => router.push("/campaigns/new")}
          >
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {campaignKpis.map((k) => (
          <div
            key={k.key}
            style={fade(i++)}
            className="bg-card border-border min-w-0 rounded-3xl border p-5 shadow-sm"
          >
            <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
              {t(`kpi.${k.key}`)}
            </span>
            <div className="font-display mt-1 text-3xl font-semibold tracking-tight">
              {k.value}
            </div>
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
              <ArrowUpRight className="size-3.5" />
              {k.delta}
            </span>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div
        style={fade(i++)}
        className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm"
      >
        <div className="border-border flex flex-wrap items-center gap-2 border-b p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="border-border bg-muted/40 placeholder:text-muted-foreground h-10 w-full rounded-xl border pr-3 pl-9 text-sm outline-none"
            />
          </div>
          <FilterMultiSelect
            label={t("statusFilter")}
            options={statusOptions}
            selected={statuses}
            onChange={setStatuses}
          />
          <FilterMultiSelect
            label={t("typeFilter")}
            options={typeOptions}
            selected={types}
            onChange={setTypes}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={t("empty")}
            hint={t("emptyHint")}
            action={
              <Button variant="outline" className="rounded-xl" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("col.campaign")}</TableHead>
                <TableHead>{t("col.channels")}</TableHead>
                <TableHead className="text-right">{t("col.sent")}</TableHead>
                <TableHead className="text-right">{t("col.open")}</TableHead>
                <TableHead className="text-right">{t("col.click")}</TableHead>
                <TableHead>{t("col.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <Row key={c.id} campaign={c} router={router} t={t} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function Row({
  campaign: c,
  router,
  t,
}: {
  campaign: Campaign;
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <TableRow
      className="cursor-pointer"
      onClick={() =>
        router.push({ pathname: "/campaigns/[id]", params: { id: c.id } })
      }
    >
      <TableCell>
        <div className="font-bold">{c.name}</div>
        <div className="text-muted-foreground/70 text-xs font-semibold">
          {t(c.trigger)} · {t(`type.${c.type}`)}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {c.channels.map((ch) => {
            const Icon = CHANNEL_ICON[ch];
            return (
              <span
                key={ch}
                className="bg-muted text-muted-foreground grid size-6 place-items-center rounded-md"
              >
                <Icon className="size-3" />
              </span>
            );
          })}
        </div>
      </TableCell>
      <TableCell className="text-right font-bold">
        {c.sent.toLocaleString()}
      </TableCell>
      <TableCell className="text-muted-foreground text-right font-semibold">
        {c.open}%
      </TableCell>
      <TableCell className="text-primary text-right font-extrabold">
        {c.click}%
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={
            c.status === "active"
              ? "text-emerald-600"
              : c.status === "paused"
                ? "text-amber-600"
                : "text-muted-foreground"
          }
        >
          {t(`status.${c.status}`)}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
