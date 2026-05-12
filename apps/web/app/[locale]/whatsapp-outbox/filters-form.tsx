"use client";

import { useDebounce } from "ahooks";
import { Button, Input } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import {
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { useEffect, useState } from "react";

const statusValues = ["sent", "failed"] as const;

/**
 * URL-driven filter controls. Each field maps to a search param; the
 * server component re-renders the outbox table when the URL changes.
 * Search input is debounced (350 ms) before the URL update fires.
 */
export function FiltersForm() {
  const t = useTranslations("WhatsAppOutbox");
  const [filters, setFilters] = useQueryStates(
    {
      search: parseAsString.withDefault(""),
      to: parseAsString.withDefault(""),
      status: parseAsStringLiteral(statusValues),
      page: parseAsString.withDefault("1"),
    },
    { shallow: false },
  );

  const [search, setSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(search, { wait: 350 });
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      void setFilters({ search: debouncedSearch || null, page: null });
    }
  }, [debouncedSearch, filters.search, setFilters]);

  const onStatus = (value: (typeof statusValues)[number] | null) => {
    void setFilters({ status: value, page: null });
  };

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="sm:max-w-xs"
      />
      <Input
        value={filters.to}
        onChange={(e) => void setFilters({ to: e.target.value || null, page: null })}
        placeholder={t("phonePlaceholder")}
        className="sm:max-w-[180px] font-mono text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <PillButton
          active={filters.status === null}
          onClick={() => onStatus(null)}
          label={t("statusAll")}
        />
        <PillButton
          active={filters.status === "sent"}
          onClick={() => onStatus("sent")}
          label={t("statusSent")}
        />
        <PillButton
          active={filters.status === "failed"}
          onClick={() => onStatus("failed")}
          label={t("statusFailed")}
        />
      </div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="rounded-full"
    >
      {label}
    </Button>
  );
}
