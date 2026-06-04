"use client";

import type { PromoStepKey } from "@loyalty/api/features/promotions/schemas";
import { Button, Stepper } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

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
 * Server-driven promo wizard for one draft. The draft id lives in the URL
 * (`/promotions/[id]`), and `promociones.getState` is the source of truth for
 * which step we're on — we just render `state.current`, `advance`, and
 * `publish`. See `.claude/skills/wizard/SKILL.md`.
 */
export function PromoWizard({ id }: { id: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const stateQuery = useQuery(trpc.promociones.getState.queryOptions({ id }));
  const advanceMut = useMutation(trpc.promociones.advance.mutationOptions());
  const publishMut = useMutation(trpc.promociones.publish.mutationOptions());

  if (stateQuery.error) {
    return <p className="text-sm text-destructive">{stateQuery.error.message}</p>;
  }
  if (!stateQuery.data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const { promo, state } = stateQuery.data;
  const steps = state.order.map((key) => ({
    key,
    label: STEP_LABELS[key] ?? key,
  }));

  const onAdvance = async (step: PromoStepKey, input: unknown) => {
    try {
      await advanceMut.mutateAsync({ id, step, input });
      await qc.invalidateQueries(
        trpc.promociones.getState.queryFilter({ id }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save step");
    }
  };

  const onPublish = async () => {
    try {
      await publishMut.mutateAsync({ id });
      await qc.invalidateQueries(trpc.promociones.getState.queryFilter({ id }));
      await qc.invalidateQueries(trpc.promociones.list.queryFilter());
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
