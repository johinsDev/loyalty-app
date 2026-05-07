import { protectedProcedure, router } from "../trpc";

export const premiosRouter = router({
  list: protectedProcedure.query(async () => {
    // TODO: list rewards for the active organization
    return [] as const;
  }),
});
