"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

import { RewardPublishedView } from "./reward-published-view";
import { RewardWizard } from "./reward-wizard";

/** Drafts open the wizard; published/archived rewards open the read-mostly view
 *  (mechanics + cost immutable, design/copy editable). */
export function RewardEditor({ id }: { id: string }) {
  const trpc = useTRPC();
  const rewardQuery = useQuery(trpc.rewards.getAdmin.queryOptions({ id }));
  if (!rewardQuery.data) return null;
  if (rewardQuery.data.status === "draft") return <RewardWizard id={id} />;
  return <RewardPublishedView id={id} />;
}
