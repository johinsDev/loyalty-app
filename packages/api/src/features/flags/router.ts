import { protectedProcedure, router } from "../../trpc";

/**
 * Smoke endpoint for the admin `(dev)/flags` page. Returns SERVER-side flag
 * evaluation via `ctx.flags` (the per-request binding — distinctId already baked
 * in). The dev page compares this against the client-side `useFeatureFlag` to
 * verify both transports evaluate the same per environment. With no PostHog key
 * the provider is `null` → defaults; with a key → real PostHog evaluation.
 */
export const flagsRouter = router({
  smoke: protectedProcedure.query(async ({ ctx }) => {
    const provider =
      process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_KEY
        ? "posthog"
        : "null";
    return {
      provider,
      enabled: (await ctx.flags?.isEnabled("flags-smoke", false)) ?? false,
      variant: (await ctx.flags?.getValue("flags-smoke-ab", "control")) ?? "control",
    };
  }),
});
