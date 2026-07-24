"use client";

import { parseAsString, useQueryState } from "nuqs";

import { BannerDetailModal } from "./banner-detail-modal";

/**
 * Mounts the `?detalle=<id>` quick-view modal once for the server banners list.
 * The name cell / grid card open it by writing the `detalle` param; this island
 * reads it and drives the modal.
 */
export function BannerDetailModalMount() {
  const [detailId, setDetailId] = useQueryState("detalle", parseAsString);
  return <BannerDetailModal id={detailId} onClose={() => void setDetailId(null)} />;
}
