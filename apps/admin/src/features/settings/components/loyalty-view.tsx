"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { LoyaltySection, type Mode } from "./loyalty-section";
import { StackingSection } from "./stacking-section";
import { StampsSection } from "./stamps-section";

/**
 * Lealtad page shell: the mode picked in the rules card (even before saving)
 * drives which track's configuration is on screen — choosing "Sellos" hides
 * the points equivalence/design, choosing "Puntos" hides the stamps card,
 * "Ambos" shows everything. The draft mode lives here so both cards react to
 * the same selection instantly.
 */
export function LoyaltyView() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.settings.loyaltyConfigAdmin.queryOptions());
  const [draftMode, setDraftMode] = useState<Mode | null>(null);

  const mode = draftMode ?? data?.mode ?? "both";

  return (
    <div className="space-y-6">
      <div className="bg-card border-border rounded-3xl border p-6 shadow-sm">
        <LoyaltySection onModeChange={setDraftMode} />
      </div>
      {mode !== "points" ? (
        <div className="bg-card border-border rounded-3xl border p-6 shadow-sm">
          <StampsSection />
        </div>
      ) : null}
      <div className="bg-card border-border rounded-3xl border p-6 shadow-sm">
        <StackingSection />
      </div>
    </div>
  );
}
