import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { isDevOnlyEnabled } from "@/lib/dev-only";

import { FiltersForm } from "./filters-form";
import { OutboxTable } from "./outbox-table";
import { OutboxTableSkeleton } from "./outbox-table.skeleton";

type SearchParams = Promise<{
  to?: string;
  status?: string;
  search?: string;
  page?: string;
}>;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
};

const PAGE_SIZE = 25;

/**
 * Dev-only view at `/<locale>/whatsapp-outbox`. Shows messages that
 * the `outbox` provider in `@loyalty/whatsapp` persisted to Postgres.
 * Used by devs to find OTPs sent to test users on local + preview.
 * Returns 404 in production.
 */
export default async function WhatsAppOutboxPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isDevOnlyEnabled()) notFound();

  const t = await getTranslations("WhatsAppOutbox");
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const filters = {
    to: sp.to,
    status: parseStatus(sp.status),
    search: sp.search,
  } as const;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <FiltersForm />

      <Suspense
        key={JSON.stringify({ ...filters, page })}
        fallback={<OutboxTableSkeleton />}
      >
        <OutboxTable
          to={filters.to}
          status={filters.status}
          search={filters.search}
          page={page}
          pageSize={PAGE_SIZE}
        />
      </Suspense>
    </main>
  );
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseStatus(
  raw: string | undefined,
): "sent" | "failed" | undefined {
  return raw === "sent" || raw === "failed" ? raw : undefined;
}
