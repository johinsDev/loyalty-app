"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { brandingStepSchema, type BrandingStepInput } from "@loyalty/api";
import { Button, Input, Label } from "@loyalty/ui";
import { useForm } from "react-hook-form";

export function BrandingStep({
  defaults,
  onSubmit,
  pending,
}: {
  defaults: { branding: { icon: string; color: string } | null };
  onSubmit: (input: BrandingStepInput) => Promise<void>;
  pending: boolean;
}) {
  const form = useForm<BrandingStepInput>({
    resolver: zodResolver(brandingStepSchema),
    defaultValues: {
      icon: defaults.branding?.icon ?? "",
      color: defaults.branding?.color ?? "#16a34a",
    },
  });
  const { errors } = form.formState;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex max-w-sm flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="icon">Icon</Label>
        <Input id="icon" placeholder="lucide icon name" {...form.register("icon")} />
        {errors.icon && (
          <p className="text-sm text-destructive">{errors.icon.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="color">Color (#RRGGBB)</Label>
        <Input id="color" placeholder="#16a34a" {...form.register("color")} />
        {errors.color && (
          <p className="text-sm text-destructive">{errors.color.message}</p>
        )}
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        Save &amp; continue
      </Button>
    </form>
  );
}
