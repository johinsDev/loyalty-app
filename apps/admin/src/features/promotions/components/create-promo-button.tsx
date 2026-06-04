"use client";

import { Button } from "@loyalty/ui";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/** Creates a draft promo (`status = draft` from the start) and navigates to its
 *  wizard at `/promotions/[id]`. */
export function CreatePromoButton({ label }: { label: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const createMut = useMutation(trpc.promociones.create.mutationOptions());

  const onClick = async () => {
    try {
      const res = await createMut.mutateAsync();
      router.push({
        pathname: "/promotions/[id]",
        params: { id: res.promo.id },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create promo");
    }
  };

  return (
    <Button onClick={onClick} disabled={createMut.isPending}>
      {label}
    </Button>
  );
}
