"use client";

import { Button, Input, Label } from "@loyalty/ui";
import { useState } from "react";

// Adapter step: the form shape (a comma-separated string) differs from the wire
// shape (`string[]`), so instead of reusing the step schema with zodResolver we
// map on submit and let the server's `productsStepSchema` do the validation.
export function ProductsStep({
  defaults,
  onSubmit,
  pending,
}: {
  defaults: { productIds: string[] | null };
  onSubmit: (input: { productIds: string[] }) => Promise<void>;
  pending: boolean;
}) {
  const [value, setValue] = useState((defaults.productIds ?? []).join(", "));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const productIds = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    void onSubmit({ productIds });
  };

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="productIds">Products (comma-separated ids)</Label>
        <Input
          id="productIds"
          placeholder="p1, p2, p3"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        Save &amp; continue
      </Button>
    </form>
  );
}
