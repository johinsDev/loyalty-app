import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  type RawSearchParams,
  parsePushSearchParams,
} from "../lib/parse-search-params";

import { FiltersForm } from "./filters-form";
import { OutboxTable } from "./outbox-table";
import { OutboxTableSkeleton } from "./outbox-table-skeleton";

type Props = { searchParams: RawSearchParams };

export async function OutboxList({ searchParams }: Props) {
  const t = await getTranslations("PushOutbox");
  const params = parsePushSearchParams(searchParams);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <FiltersForm />

      <Suspense
        key={JSON.stringify(params)}
        fallback={<OutboxTableSkeleton />}
      >
        <OutboxTable
          deviceToken={params.deviceToken}
          platform={params.platform}
          status={params.status}
          search={params.search}
          page={params.page}
          pageSize={params.pageSize}
        />
      </Suspense>
    </main>
  );
}
