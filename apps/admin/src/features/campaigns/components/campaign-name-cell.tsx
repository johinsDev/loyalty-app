"use client";

import { parseAsString, useQueryState } from "nuqs";

/**
 * Interactive name cell for the server campaigns table — a client island that
 * opens the `?detalle=<id>` quick-view modal. Markup mirrors the old table cell.
 */
export function CampaignNameCell({
  id,
  name,
  namePlaceholder,
}: {
  id: string;
  name: string;
  namePlaceholder: string;
}) {
  const [, setDetailId] = useQueryState("detalle", parseAsString);
  return (
    <button
      type="button"
      className="hover:text-primary flex cursor-pointer items-center gap-2.5 text-left font-semibold hover:underline"
      onClick={() => void setDetailId(id)}
    >
      <span className="line-clamp-1">{name || namePlaceholder}</span>
    </button>
  );
}
