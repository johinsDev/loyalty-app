"use client";

import {
  Badge,
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import {
  Bell,
  type LucideIcon,
  Mail,
  MessageCircle,
  MessageSquare,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { type FilterOption, FilterSelect } from "@/components/filters";
import { useFadeUp } from "@/lib/animate";

import { type Channel, feed, engagement, type Kind, type St } from "../data";

type Tab = "feed" | "quick" | "engagement";
type Audience = "all" | "active" | "atRisk";

const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};

const STATUS_TONE: Record<St, string> = {
  sent: "text-emerald-600",
  scheduled: "text-blue-600",
  failed: "text-rose-600",
};

/**
 * Notifications — a design-first hub with three views: a sent/scheduled feed
 * (search + kind filter + table), a Quick push composer with a live preview,
 * and a weekly engagement panel. Hardcoded (../data); the send button is a
 * toast stub until the @loyalty/notifications fan-out is wired.
 */
export function NotificationsView() {
  const t = useTranslations("Notifications");
  const [tab, setTab] = useState<Tab>("feed");

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
          {t("subtitle")}
        </p>
      </div>

      <div className="border-border mt-5 flex items-center gap-5 border-b">
        <UnderlineTab active={tab === "feed"} onClick={() => setTab("feed")}>
          {t("tab.feed")}
        </UnderlineTab>
        <UnderlineTab active={tab === "quick"} onClick={() => setTab("quick")}>
          {t("tab.quick")}
        </UnderlineTab>
        <UnderlineTab
          active={tab === "engagement"}
          onClick={() => setTab("engagement")}
        >
          {t("tab.engagement")}
        </UnderlineTab>
      </div>

      <div className="mt-5">
        {tab === "feed" ? <Feed /> : null}
        {tab === "quick" ? <Quick /> : null}
        {tab === "engagement" ? <Engagement /> : null}
      </div>
    </div>
  );
}

function Feed() {
  const t = useTranslations("Notifications");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);

  const kindOptions: FilterOption<Kind>[] = [
    { value: "promo", label: t("filter.promo") },
    { value: "system", label: t("filter.system") },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feed.filter((n) => {
      if (kind && n.kind !== kind) return false;
      if (q && !n.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, kind]);

  return (
    <div className="bg-card border-border overflow-hidden rounded-3xl border shadow-sm">
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
        <FilterSelect
          allLabel={t("feedFilter")}
          value={kind}
          onValueChange={setKind}
          options={kindOptions}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Bell} title={t("emptyFeed")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("col.message")}</TableHead>
              <TableHead>{t("col.channel")}</TableHead>
              <TableHead>{t("col.audience")}</TableHead>
              <TableHead>{t("col.date")}</TableHead>
              <TableHead>{t("col.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((n) => {
              const Icon = CHANNEL_ICON[n.channel];
              return (
                <TableRow key={n.id}>
                  <TableCell className="max-w-md">
                    <div className="font-bold">{n.title}</div>
                    <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                      {n.body}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-md">
                      <Icon className="size-3.5" />
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-semibold">
                    {n.audience}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-semibold">
                    {n.date}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_TONE[n.status]}>
                      {t(`st.${n.status}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Quick() {
  const t = useTranslations("Notifications");
  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const onSend = () => {
    toast.success(t("sent"));
    setTitle("");
    setBody("");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="bg-card border-border rounded-3xl border p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("quickTitle")}
        </h2>
        <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
          {t("quickDesc")}
        </p>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="quick-audience">{t("audience")}</Label>
            <NativeSelect
              id="quick-audience"
              size="lg"
              className="w-full"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
            >
              <NativeSelectOption value="all">
                {t("audienceOpt.all")}
              </NativeSelectOption>
              <NativeSelectOption value="active">
                {t("audienceOpt.active")}
              </NativeSelectOption>
              <NativeSelectOption value="atRisk">
                {t("audienceOpt.atRisk")}
              </NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quick-title">{t("qtitle")}</Label>
            <Input
              id="quick-title"
              className="h-10"
              placeholder={t("qtitlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quick-body">{t("qbody")}</Label>
            <textarea
              id="quick-body"
              rows={4}
              placeholder={t("qbodyPlaceholder")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />
          </div>

          <Button className="h-10 w-full rounded-xl font-semibold" onClick={onSend}>
            <Bell className="size-4" />
            {t("send")}
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6">
        <PushPreview title={title} body={body} placeholder={t("qtitlePlaceholder")} />
      </div>
    </div>
  );
}

function PushPreview({
  title,
  body,
  placeholder,
}: {
  title: string;
  body: string;
  placeholder: string;
}) {
  return (
    <div className="bg-card border-border rounded-3xl border p-4 shadow-sm">
      <div className="bg-muted/40 border-border flex items-start gap-3 rounded-2xl border p-3.5">
        <span className="bg-primary/10 text-primary grid size-8 flex-none place-items-center rounded-full">
          <Bell className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{title || placeholder}</p>
          <p className="text-muted-foreground mt-0.5 line-clamp-3 text-sm leading-relaxed">
            {body || "…"}
          </p>
          <span className="text-muted-foreground/70 mt-1.5 block text-xs font-semibold">
            T4 Diver Club · ahora
          </span>
        </div>
      </div>
    </div>
  );
}

function Engagement() {
  const t = useTranslations("Notifications");
  const fade = useFadeUp({ step: 60 });
  const cards = [
    { key: "engSent", value: engagement.sent },
    { key: "engOpen", value: engagement.open },
    { key: "engClick", value: engagement.click },
  ];

  return (
    <div>
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {t("engTitle")}
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <div
            key={c.key}
            style={fade(i)}
            className="bg-card border-border min-w-0 rounded-3xl border p-5 shadow-sm"
          >
            <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
              {t(c.key)}
            </span>
            <div className="font-display mt-1 text-3xl font-semibold tracking-tight">
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnderlineTab({
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
      className={`relative -mb-px flex items-center gap-1.5 border-b-2 py-3 text-sm font-semibold transition-colors ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
