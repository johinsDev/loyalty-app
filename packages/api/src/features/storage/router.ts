import { TRPCError } from "@trpc/server";

import { protectedProcedure, router } from "../../trpc";
import {
  createDownloadUrlInputSchema,
  createUploadUrlInputSchema,
  deleteInputSchema,
  listInputSchema,
} from "./schemas";
import { StorageService } from "./service";

function requireStorage(ctx: { storage?: unknown }) {
  if (!ctx.storage) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "storage manager not bound to ctx. Wire `apps/<app>/src/lib/storage.ts`.",
    });
  }
  return ctx.storage as ConstructorParameters<typeof StorageService>[0];
}

/**
 * `protectedProcedure` on every op — uploads are tied to authenticated
 * users. The mutations that issue presigned URLs return short-lived
 * tokens (5 min) so even if the URL leaks the blast radius is small.
 */
export const storageRouter = router({
  createUploadUrl: protectedProcedure
    .input(createUploadUrlInputSchema)
    .mutation(({ ctx, input }) => {
      const service = new StorageService(requireStorage(ctx));
      return service.createUploadUrl(input);
    }),

  createDownloadUrl: protectedProcedure
    .input(createDownloadUrlInputSchema)
    .mutation(({ ctx, input }) => {
      const service = new StorageService(requireStorage(ctx));
      return service.createDownloadUrl(input);
    }),

  delete: protectedProcedure
    .input(deleteInputSchema)
    .mutation(({ ctx, input }) => {
      const service = new StorageService(requireStorage(ctx));
      return service.delete(input);
    }),

  list: protectedProcedure.input(listInputSchema).query(({ ctx, input }) => {
    const service = new StorageService(requireStorage(ctx));
    return service.list(input);
  }),
});
