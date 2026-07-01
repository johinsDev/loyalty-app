"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/lib/trpc/client";

/**
 * One-shot image upload: presign → PUT → resolve download URL, returning the
 * stored URL (or null on failure). For callers that need a single URL back
 * inline (e.g. `BackgroundPicker`'s `onUploadImage`) rather than the streaming
 * entry state machine of `useFileUpload`.
 */
export function useUploadImage(disk?: string) {
  const trpc = useTRPC();
  const createUploadUrl = useMutation(trpc.storage.createUploadUrl.mutationOptions());
  const createDownloadUrl = useMutation(trpc.storage.createDownloadUrl.mutationOptions());

  return useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const presigned = await createUploadUrl.mutateAsync({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          ...(disk ? { disk } : {}),
        });
        const res = await fetch(presigned.url, {
          method: presigned.method,
          headers: presigned.headers ?? {},
          // presigned.method is the R2 upload verb (PUT); the linter can't infer it.
          // eslint-disable-next-line unicorn/no-invalid-fetch-options
          body: file,
        });
        if (!res.ok) return null;
        const { url } = await createDownloadUrl.mutateAsync({
          key: presigned.key,
          ...(disk ? { disk } : {}),
        });
        return url;
      } catch {
        return null;
      }
    },
    [createUploadUrl, createDownloadUrl, disk],
  );
}
