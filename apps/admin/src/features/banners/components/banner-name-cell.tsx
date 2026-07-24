"use client";

import { parseAsString, useQueryState } from "nuqs";

/**
 * Interactive name cell for the server banners table — a client island that
 * opens the `?detalle=<id>` quick-view modal. The swatch + label mirror the old
 * table cell exactly.
 */
export function BannerNameCell({
  id,
  name,
  namePlaceholder,
  backgroundCss,
}: {
  id: string;
  name: string;
  namePlaceholder: string;
  backgroundCss: string | null;
}) {
  const [, setDetailId] = useQueryState("detalle", parseAsString);
  return (
    <button
      type="button"
      className="hover:text-primary flex cursor-pointer items-center gap-2.5 text-left font-semibold hover:underline"
      onClick={() => void setDetailId(id)}
    >
      <span
        className="border-border size-8 shrink-0 rounded-lg border"
        style={{ background: backgroundCss ?? "var(--muted)" }}
      />
      <span className="line-clamp-1">{name || namePlaceholder}</span>
    </button>
  );
}
