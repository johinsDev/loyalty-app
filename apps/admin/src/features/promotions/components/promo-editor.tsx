"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

import { PromoPublishedView } from "./promo-published-view";
import { PromoWizard } from "./promo-wizard";

/** Drafts open the wizard; published/archived promos open the read-mostly view
 *  (mechanics immutable, design/copy editable). */
export function PromoEditor({ id }: { id: string }) {
  const trpc = useTRPC();
  const promoQuery = useQuery(trpc.promociones.get.queryOptions({ id }));
  if (!promoQuery.data) return null;
  if (promoQuery.data.status === "draft") return <PromoWizard id={id} />;
  return <PromoPublishedView id={id} />;
}
