"use client";

import { parseAsString, useQueryState } from "nuqs";

import { EmployeeDetailModal } from "./employee-detail-modal";

/**
 * Mounts the `?detalle=<memberId>` quick-view modal once for the server
 * employees list. The name cell / grid card / row menu open it by writing the
 * `detalle` param; this island reads it and drives the modal.
 */
export function EmployeeDetailModalMount() {
  const [detailId, setDetailId] = useQueryState("detalle", parseAsString);
  return <EmployeeDetailModal id={detailId} onClose={() => void setDetailId(null)} />;
}
