"use client";

import type { AppRouter } from "@loyalty/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { MapPin, Navigation, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import {
  type DayHours,
  formatRange,
  getStoreStatus,
  mapsEmbedUrl,
  mapsSearchUrl,
  telUrl,
  toHoursMap,
  WEEK_ORDER,
  weekdayName,
} from "../data";

type StoreItem = inferRouterOutputs<AppRouter>["stores"]["listPublic"][number];

const SOCIAL_ORDER = ["instagram", "whatsapp", "facebook", "tiktok", "x", "website"] as const;

/** Customer store screen: a branch switcher (when >1), the location's static map
 *  (or a keyless embed fallback), open/closed status, weekly hours and the
 *  call / view-on-map / directions actions + brand social links. */
export function StoreScreen({
  stores,
  social,
}: {
  stores: StoreItem[];
  social: Record<string, string>;
}) {
  const t = useTranslations("Store");
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState(
    () => stores.find((s) => s.isPrimary)?.id ?? stores[0]?.id ?? "",
  );
  const store = stores.find((s) => s.id === selectedId) ?? stores[0];
  if (!store) return null;

  const hours = toHoursMap(store.hours);
  const status = getStoreStatus({ timezone: store.timezone, hours }, new Date());
  const query = `${store.name}, ${store.address ?? ""}`;
  // The embed centers on exact coordinates when known (geocoding the name drifts
  // to a wrong POI); the search/directions links keep the human query.
  const mapEmbedQuery =
    store.lat != null && store.lng != null ? `${store.lat},${store.lng}` : query;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const statusHint =
    status.hint.kind === "closesAt"
      ? t("closesAt", { time: status.hint.time })
      : status.hint.kind === "opensAt"
        ? t("opensAt", { time: status.hint.time })
        : t("opensDay", { day: cap(weekdayName(status.hint.dayIndex, locale)), time: status.hint.time });

  const socials = SOCIAL_ORDER.filter((k) => social[k]);

  return (
    <div className="space-y-5">
      {stores.length > 1 ? (
        <Select value={selectedId} onValueChange={(v) => setSelectedId(v ?? selectedId)}>
          <SelectTrigger size="lg" className="w-full">
            <SelectValue>{() => store.name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {/* Map: saved static screenshot, else a keyless embed. */}
      <div className="ring-border h-44 overflow-hidden rounded-3xl ring-1">
        {store.mapStaticUrl ? (
          <Image
            src={store.mapStaticUrl}
            alt={t("mapTitle", { name: store.name })}
            width={640}
            height={320}
            className="size-full object-cover"
          />
        ) : (
          // oxlint-disable react/iframe-missing-sandbox
          <iframe
            title={t("mapTitle", { name: store.name })}
            src={mapsEmbedUrl(mapEmbedQuery)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="size-full border-0"
          />
          // oxlint-enable react/iframe-missing-sandbox
        )}
      </div>

      <div className="bg-card rounded-3xl p-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">{store.name}</h2>
            {store.address ? (
              <p className="text-muted-foreground mt-0.5 text-sm">{store.address}</p>
            ) : null}
          </div>
          <MapPin className="text-primary size-5 shrink-0" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-2 font-bold">
            <span className={`size-2 rounded-full ${status.open ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            <span className={status.open ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}>
              {status.open ? t("open") : t("closed")}
            </span>
          </span>
          <span className="text-muted-foreground">· {statusHint}</span>
        </div>

        <p className="text-muted-foreground mt-5 mb-1 px-1 text-xs font-bold tracking-wider">
          {t("hoursTitle")}
        </p>
        <div className="bg-muted/50 rounded-2xl px-4">
          {WEEK_ORDER.map((idx) => (
            <HourRow
              key={idx}
              day={cap(weekdayName(idx, locale))}
              hours={hours[idx] ?? null}
              closedLabel={t("closedAllDay")}
              todayLabel={t("today")}
              today={idx === status.todayIndex}
            />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {store.phone ? (
            <a
              href={telUrl(store.phone)}
              className="border-border hover:bg-muted/60 flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-bold transition-colors"
            >
              <Phone className="size-4" />
              {t("call")}
            </a>
          ) : null}
          <a
            href={mapsSearchUrl(query)}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border hover:bg-muted/60 flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-bold transition-colors"
          >
            <MapPin className="size-4" />
            {t("viewMap")}
          </a>
        </div>
        <a
          href={store.directionsUrl ?? mapsSearchUrl(query)}
          target="_blank"
          rel="noopener noreferrer"
          className="from-primary to-primary/70 shadow-primary/30 mt-2.5 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br text-base font-bold text-white shadow-lg transition-transform active:scale-[0.99]"
        >
          <Navigation className="size-5" />
          {t("directions")}
        </a>

        {socials.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {socials.map((k) => (
              <a
                key={k}
                href={k === "whatsapp" ? `https://wa.me/${social[k]!.replace(/[^0-9]/g, "")}` : social[k]}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border hover:bg-muted/60 rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition-colors"
              >
                {k}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HourRow({
  day,
  hours,
  closedLabel,
  todayLabel,
  today,
}: {
  day: string;
  hours: DayHours;
  closedLabel: string;
  todayLabel: string;
  today: boolean;
}) {
  const range = formatRange(hours);
  return (
    <div
      className={`border-border/60 flex items-center justify-between border-b py-2.5 text-sm last:border-b-0 ${
        today ? "text-foreground font-extrabold" : "text-muted-foreground font-semibold"
      }`}
    >
      <span>
        {day}
        {today ? <span className="text-primary"> · {todayLabel}</span> : null}
      </span>
      <span>{range ?? closedLabel}</span>
    </div>
  );
}
