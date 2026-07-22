"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

/** Per-link analytics: total clicks, clicks-by-day bars, top countries. */
export function ShortlinkDetail({ id }: { id: string }) {
  const t = useTranslations("Shortlinks");
  const trpc = useTRPC();
  const q = useQuery(
    trpc.shortlinks.analytics.queryOptions({ id, sinceDays: 30 }),
  );

  if (q.isLoading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground text-sm">{t("loading")}</p>
      </main>
    );
  }
  if (!q.data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground text-sm">{t("notFound")}</p>
        <Link href="/shortlinks" className="text-primary hover:underline">
          {t("back")}
        </Link>
      </main>
    );
  }

  const { link, clicksByDay, topCountries } = q.data;
  const maxDay = Math.max(1, ...clicksByDay.map((d) => d.clicks));

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-1">
        <Link
          href="/shortlinks"
          className="text-muted-foreground text-sm hover:underline"
        >
          ← {t("back")}
        </Link>
        <h1 className="font-mono font-semibold text-2xl">/{link.slug}</h1>
        <a
          href={link.targetUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all text-muted-foreground text-sm hover:underline"
        >
          {link.targetUrl}
        </a>
        <p className="pt-2 text-3xl tabular-nums">
          {link.clickCount}{" "}
          <span className="text-base text-muted-foreground">
            {t("totalClicks")}
          </span>
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-medium">{t("clicksByDay")}</h2>
        {clicksByDay.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noClicks")}</p>
        ) : (
          <ul className="space-y-1">
            {clicksByDay.map((d) => (
              <li key={d.day} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 font-mono text-muted-foreground text-xs">
                  {d.day}
                </span>
                <span
                  className="h-3 rounded bg-primary"
                  style={{ width: `${(d.clicks / maxDay) * 100}%` }}
                />
                <span className="tabular-nums">{d.clicks}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">{t("topCountries")}</h2>
        {topCountries.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noClicks")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {topCountries.map((c) => (
              <li key={c.country} className="flex justify-between">
                <span>{c.country}</span>
                <span className="tabular-nums">{c.clicks}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
