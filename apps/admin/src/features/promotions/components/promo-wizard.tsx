"use client";

import type { PromoStepKey } from "@loyalty/api/features/promotions/schemas";
import { Button, Stepper } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import { usePromoWizardStore } from "../state/promo-wizard-store";
import { BrandingStep } from "./steps/branding-step";
import { ProductsStep } from "./steps/products-step";
import { ScheduleStep } from "./steps/schedule-step";
import { SegmentStep } from "./steps/segment-step";

const STEP_LABELS: Record<string, string> = {
  segment: "Segment",
  products: "Products",
  branding: "Branding",
  schedule: "Schedule",
};

/**
 * Server-driven promo wizard. The backend owns the step sequence: we `create`
 * the draft once (it persists as `draft` from step 1), then loop
 * `getState` → render `state.current` → `advance` → re-`getState`, and `publish`
 * once `state.canPublish`. See `.claude/skills/wizard/SKILL.md`.
 */
export function PromoWizard() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const draftId = usePromoWizardStore((s) => s.draftId);
  const setDraftId = usePromoWizardStore((s) => s.setDraftId);

  const createMut = useMutation(trpc.promociones.create.mutationOptions());
  const advanceMut = useMutation(trpc.promociones.advance.mutationOptions());
  const publishMut = useMutation(trpc.promociones.publish.mutationOptions());

  // Create the draft exactly once (ref-guarded against StrictMode double-run).
  const startedRef = useRef(false);
  useEffect(() => {
    if (draftId || startedRef.current) return;
    startedRef.current = true;
    createMut
      .mutateAsync()
      .then((res) => setDraftId(res.promo.id))
      .catch((err: Error) => {
        startedRef.current = false;
        toast.error(err.message);
      });
  }, [draftId, createMut, setDraftId]);

  const stateQuery = useQuery(
    trpc.promociones.getState.queryOptions(
      { id: draftId ?? "" },
      { enabled: !!draftId },
    ),
  );

  if (stateQuery.error) {
    return <p className="text-sm text-destructive">{stateQuery.error.message}</p>;
  }
  if (!draftId || !stateQuery.data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const { promo, state } = stateQuery.data;
  const steps = state.order.map((key) => ({
    key,
    label: STEP_LABELS[key] ?? key,
  }));

  const onAdvance = async (step: PromoStepKey, input: unknown) => {
    try {
      await advanceMut.mutateAsync({ id: draftId, step, input });
      await qc.invalidateQueries(
        trpc.promociones.getState.queryFilter({ id: draftId }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save step");
    }
  };

  const onPublish = async () => {
    try {
      await publishMut.mutateAsync({ id: draftId });
      await qc.invalidateQueries(
        trpc.promociones.getState.queryFilter({ id: draftId }),
      );
      toast.success("Promo published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish");
    }
  };

  const pending = advanceMut.isPending;

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={steps} current={state.current} completed={state.completed} />

      {promo.status === "published" ? (
        <p className="text-sm font-medium text-primary">Published ✓</p>
      ) : state.current === "segment" ? (
        <SegmentStep
          defaults={promo}
          onSubmit={(i) => onAdvance("segment", i)}
          pending={pending}
        />
      ) : state.current === "products" ? (
        <ProductsStep
          defaults={promo}
          onSubmit={(i) => onAdvance("products", i)}
          pending={pending}
        />
      ) : state.current === "branding" ? (
        <BrandingStep
          defaults={promo}
          onSubmit={(i) => onAdvance("branding", i)}
          pending={pending}
        />
      ) : state.current === "schedule" ? (
        <ScheduleStep
          defaults={promo}
          onSubmit={(i) => onAdvance("schedule", i)}
          pending={pending}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Everything's set. Review the steps above, then publish.
          </p>
          <Button
            onClick={onPublish}
            disabled={publishMut.isPending}
            className="self-start"
          >
            Publish promo
          </Button>
        </div>
      )}
    </div>
  );
}
