import { protectedProcedure, router } from "../trpc";

export const clientesRouter = router({
  list: protectedProcedure.query(async () => {
    // TODO: list customers for the active organization
    return [] as const;
  }),
});
