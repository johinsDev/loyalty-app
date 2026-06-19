import { SidebarInset, SidebarProvider } from "@loyalty/ui";
import { MapPin, Navigation, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { AppSidebar } from "@/features/home/components/app-sidebar";

import {
  type DayHours,
  formatRange,
  getStoreStatus,
  mapsDirectionsUrl,
  mapsEmbedUrl,
  mapsSearchUrl,
  store,
  telUrl,
  WEEK_ORDER,
  weekdayName,
} from "../data";

/**
 * Customer "Nuestra tienda" page — a faithful build of the single-store branch
 * of the "T4 · Ubicaciones" Claude Design template: an embedded Google map, the
 * store's open/closed status, its weekly hours (today highlighted) and the
 * call / view-on-map / directions actions. Mobile-first; on desktop the bottom
 * nav gives way to the sidebar and the layout widens. The store is hardcoded
 * (see `../data`) until the locations API lands. Everything here is static, so
 * the screen is a plain server component — reached from the profile screen.
 */
export async function StoreView() {
  const t = await getTranslations("Store");
  const locale = await getLocale();
  const status = getStoreStatus(store, new Date());

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const statusHint =
    status.hint.kind === "closesAt"
      ? t("closesAt", { time: status.hint.time })
      : status.hint.kind === "opensAt"
        ? t("opensAt", { time: status.hint.time })
        : t("opensDay", {
            day: cap(weekdayName(status.hint.dayIndex, locale)),
            time: status.hint.time,
          });

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-2xl lg:px-8 lg:pt-12">
          <header className="mb-5">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
          </header>

          {/* Embedded Google map (keyless — no API key required). */}
          <div className="ring-border mb-5 h-44 overflow-hidden rounded-3xl ring-1">
            {/* The Google Maps embed needs both allow-scripts and allow-same-origin
                to render an interactive map; the rule forbids that pair, but the
                framed origin is trusted first-party Google. */}
            {/* oxlint-disable react/iframe-missing-sandbox */}
            <iframe
              title={t("mapTitle", { name: store.name })}
              src={mapsEmbedUrl(store)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="size-full border-0"
            />
            {/* oxlint-enable react/iframe-missing-sandbox */}
          </div>

          <section className="bg-card rounded-3xl p-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight">{store.name}</h2>
                <p className="text-muted-foreground mt-0.5 text-sm">{store.address}</p>
              </div>
              <MapPin className="text-primary size-5 shrink-0" />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-2 font-bold">
                <span
                  className={`size-2 rounded-full ${
                    status.open ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
                <span className={status.open ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}>
                  {status.open ? t("open") : t("closed")}
                </span>
              </span>
              <span className="text-muted-foreground">· {statusHint}</span>
            </div>

            {/* Weekly hours, Monday-first, today emphasized. */}
            <p className="text-muted-foreground mt-5 mb-1 px-1 text-xs font-bold tracking-wider">
              {t("hoursTitle")}
            </p>
            <div className="bg-muted/50 rounded-2xl px-4">
              {WEEK_ORDER.map((idx) => (
                <HourRow
                  key={idx}
                  day={cap(weekdayName(idx, locale))}
                  hours={store.hours[idx] ?? null}
                  closedLabel={t("closedAllDay")}
                  todayLabel={t("today")}
                  today={idx === status.todayIndex}
                />
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <a
                href={telUrl(store)}
                className="border-border hover:bg-muted/60 flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-bold transition-colors"
              >
                <Phone className="size-4" />
                {t("call")}
              </a>
              <a
                href={mapsSearchUrl(store)}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border hover:bg-muted/60 flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-bold transition-colors"
              >
                <MapPin className="size-4" />
                {t("viewMap")}
              </a>
            </div>
            <a
              href={mapsDirectionsUrl(store)}
              target="_blank"
              rel="noopener noreferrer"
              className="from-primary to-primary/70 shadow-primary/30 mt-2.5 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br text-base font-bold text-white shadow-lg transition-transform active:scale-[0.99]"
            >
              <Navigation className="size-5" />
              {t("directions")}
            </a>
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
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
