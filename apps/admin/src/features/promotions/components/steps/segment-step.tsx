"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { segmentStepSchema, type SegmentStepInput } from "@loyalty/api";
import { Button, Input, Label } from "@loyalty/ui";
import { useForm } from "react-hook-form";

// Shared-schema step: the wire shape == the form shape, so we reuse the exact
// `segmentStepSchema` from @loyalty/api with zodResolver (zod skill).
export function SegmentStep({
  defaults,
  onSubmit,
  pending,
}: {
  defaults: { name: string | null; segmentId: string | null };
  onSubmit: (input: SegmentStepInput) => Promise<void>;
  pending: boolean;
}) {
  const form = useForm<SegmentStepInput>({
    resolver: zodResolver(segmentStepSchema),
    defaultValues: {
      name: defaults.name ?? "",
      segmentId: defaults.segmentId ?? "",
    },
  });
  const { errors } = form.formState;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex max-w-sm flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="segmentId">Target segment</Label>
        <Input id="segmentId" placeholder="segment id" {...form.register("segmentId")} />
        {errors.segmentId && (
          <p className="text-sm text-destructive">{errors.segmentId.message}</p>
        )}
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        Save &amp; continue
      </Button>
    </form>
  );
}
