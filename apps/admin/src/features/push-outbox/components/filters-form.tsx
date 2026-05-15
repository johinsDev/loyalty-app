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
const platformValues = ["webpush", "expo"] as const;

/**
 * URL-driven filter controls for `push_outbox`. Two pill groups:
 * platform (webpush / expo) + status (sent / failed). A text search
 * over the title (high-signal field) and a token fragment search.
 */
export function FiltersForm() {
  const t = useTranslations("PushOutbox");
  const [filters, setFilters] = useQueryStates(
    {
      search: parseAsString.withDefault(""),
      deviceToken: parseAsString.withDefault(""),
      status: parseAsStringLiteral(statusValues),
      platform: parseAsStringLiteral(platformValues),
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
  const onPlatform = (value: (typeof platformValues)[number] | null) => {
    void setFilters({ platform: value, page: null });
  };

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="sm:max-w-xs"
      />
      <Input
        value={filters.deviceToken}
        onChange={(e) =>
          void setFilters({ deviceToken: e.target.value || null, page: null })
        }
        placeholder={t("tokenPlaceholder")}
        className="sm:max-w-[240px] text-sm font-mono"
      />
      <div className="flex flex-wrap items-center gap-2">
        <PillButton
          active={filters.platform === null}
          onClick={() => onPlatform(null)}
          label={t("platformAll")}
        />
        <PillButton
          active={filters.platform === "webpush"}
          onClick={() => onPlatform("webpush")}
          label={t("platformWebpush")}
        />
        <PillButton
          active={filters.platform === "expo"}
          onClick={() => onPlatform("expo")}
          label={t("platformExpo")}
        />
      </div>
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
