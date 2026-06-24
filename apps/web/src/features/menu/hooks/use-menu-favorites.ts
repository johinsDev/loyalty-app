"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

/**
 * Per-user product favorites: the set of favorited ids + an optimistic toggle.
 * Used by the menu cards and the product detail. Favorites are never cached
 * server-side (they're per-user) — this is a plain client query.
 */
export function useMenuFavorites() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const filter = trpc.menu.myFavoriteIds.queryFilter();

  const { data: ids } = useQuery(trpc.menu.myFavoriteIds.queryOptions());
  const favSet = new Set(ids ?? []);

  const toggle = useMutation(
    trpc.menu.toggleFavorite.mutationOptions({
      onMutate: async ({ productId }) => {
        await queryClient.cancelQueries(filter);
        const prev = queryClient.getQueryData<string[]>(filter.queryKey);
        const next = prev?.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...(prev ?? []), productId];
        queryClient.setQueryData(filter.queryKey, next);
        return { prev };
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.prev) queryClient.setQueryData(filter.queryKey, ctx.prev);
      },
      onSettled: () => {
        void queryClient.invalidateQueries(filter);
        void queryClient.invalidateQueries(trpc.menu.myFavorites.queryFilter());
      },
    }),
  );

  return {
    isFavorite: (productId: string) => favSet.has(productId),
    toggleFavorite: (productId: string) => toggle.mutate({ productId }),
  };
}
