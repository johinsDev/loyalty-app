"use client";

import { parseAsString, useQueryState } from "nuqs";

import { CampaignDetailModal } from "./campaign-detail-modal";

/**
 * Mounts the `?detalle=<id>` quick-view modal once for the server campaigns
 * list. The name cell / grid card / row menu open it by writing the `detalle`
 * param; this island reads it and drives the modal.
 */
export function CampaignDetailModalMount() {
  const [detailId, setDetailId] = useQueryState("detalle", parseAsString);
  return <CampaignDetailModal id={detailId} onClose={() => void setDetailId(null)} />;
}
