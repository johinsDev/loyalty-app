"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

export type FileUploadStatus = "queued" | "uploading" | "success" | "error";

export interface FileUploadEntry {
  id: string;
  file: File;
  key: string | null;
  status: FileUploadStatus;
  /** 0–100 */
  progress: number;
  /** Object URL while uploading; replaced by the signed download URL on success. */
  previewUrl: string | null;
  /** Set on success — this is the URL the form value points at. */
  url: string | null;
  /** Set on failure. */
  error: string | null;
}

export interface UseFileUploadArgs {
  /** Restrict the kinds of files accepted. */
  accept?: Record<string, readonly string[]>;
  /** Max bytes per file. Pre-flight + server-enforced via signed token. */
  maxSize?: number;
  /** Disk to upload to. Defaults to the manager's default disk. */
  disk?: string;
  onSuccess?: (entry: FileUploadEntry) => void;
  onError?: (entry: FileUploadEntry) => void;
}

interface UseFileUploadReturn {
  entries: FileUploadEntry[];
  add: (files: File[]) => void;
  remove: (id: string) => void;
  clear: () => void;
  isUploading: boolean;
  /** URLs of the successfully uploaded files (in entry order). */
  successUrls: string[];
}

/**
 * Owns the upload state machine. One hook per "drop area"; doesn't
 * care about UI — feed `entries` into `<DropzoneListItem>` and pump
 * `add` from `<Dropzone onDrop>`.
 *
 * Lifecycle per file:
 *   1. add()                                  → status="queued",   progress=0
 *   2. tRPC storage.createUploadUrl           → key + presigned PUT
 *   3. XHR PUT with onprogress                → status="uploading", progress=0..100
 *   4. tRPC storage.createDownloadUrl         → url set, status="success"
 *   5. (on failure)                           → status="error"
 *
 * Aborts the in-flight XHR if the entry is removed mid-upload.
 */
export function useFileUpload(args: UseFileUploadArgs = {}): UseFileUploadReturn {
  const trpc = useTRPC();
  const createUploadUrl = useMutation(
    trpc.storage.createUploadUrl.mutationOptions(),
  );
  const createDownloadUrl = useMutation(
    trpc.storage.createDownloadUrl.mutationOptions(),
  );

  const [entries, setEntries] = useState<FileUploadEntry[]>([]);
  const xhrsRef = useRef(new Map<string, XMLHttpRequest>());

  const updateEntry = useCallback(
    (id: string, patch: Partial<FileUploadEntry>) => {
      setEntries((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      );
    },
    [],
  );

  const callbacksRef = useRef(args);
  callbacksRef.current = args;

  const uploadOne = useCallback(
    async (entry: FileUploadEntry) => {
      try {
        if (args.maxSize !== undefined && entry.file.size > args.maxSize) {
          throw new Error(
            `Archivo demasiado grande (${entry.file.size} > ${args.maxSize} bytes)`,
          );
        }
        const presigned = await createUploadUrl.mutateAsync({
          fileName: entry.file.name,
          contentType: entry.file.type || "application/octet-stream",
          ...(args.disk && { disk: args.disk }),
          ...(args.maxSize !== undefined && { maxSize: args.maxSize }),
        });
        updateEntry(entry.id, {
          key: presigned.key,
          status: "uploading",
        });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrsRef.current.set(entry.id, xhr);
          xhr.open(presigned.method, presigned.url, true);
          for (const [k, v] of Object.entries(presigned.headers ?? {})) {
            xhr.setRequestHeader(k, v);
          }
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              updateEntry(entry.id, {
                progress: Math.round((e.loaded / e.total) * 100),
              });
            }
          });
          xhr.addEventListener("load", () => {
            xhrsRef.current.delete(entry.id);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(
                new Error(`upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`),
              );
            }
          });
          xhr.addEventListener("error", () => {
            xhrsRef.current.delete(entry.id);
            reject(new Error("network error"));
          });
          xhr.addEventListener("abort", () => {
            xhrsRef.current.delete(entry.id);
            reject(new Error("aborted"));
          });
          xhr.send(entry.file);
        });

        const { url } = await createDownloadUrl.mutateAsync({
          key: presigned.key,
          ...(args.disk && { disk: args.disk }),
        });
        updateEntry(entry.id, {
          progress: 100,
          status: "success",
          url,
        });
        const finalEntry: FileUploadEntry = {
          ...entry,
          key: presigned.key,
          progress: 100,
          status: "success",
          url,
        };
        callbacksRef.current.onSuccess?.(finalEntry);
      } catch (err) {
        const message = err instanceof Error ? err.message : "upload failed";
        updateEntry(entry.id, { status: "error", error: message });
        const failedEntry: FileUploadEntry = {
          ...entry,
          status: "error",
          error: message,
        };
        callbacksRef.current.onError?.(failedEntry);
      }
    },
    [args.disk, args.maxSize, createUploadUrl, createDownloadUrl, updateEntry],
  );

  const add = useCallback(
    (files: File[]) => {
      const newEntries: FileUploadEntry[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        key: null,
        status: "queued",
        progress: 0,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
        url: null,
        error: null,
      }));
      setEntries((prev) => [...prev, ...newEntries]);
      // Kick off uploads in parallel
      for (const entry of newEntries) {
        void uploadOne(entry);
      }
    },
    [uploadOne],
  );

  const remove = useCallback((id: string) => {
    const xhr = xhrsRef.current.get(id);
    if (xhr) xhr.abort();
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    for (const xhr of xhrsRef.current.values()) xhr.abort();
    xhrsRef.current.clear();
    setEntries((prev) => {
      for (const e of prev) {
        if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
      }
      return [];
    });
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const entry of entries) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
      for (const xhr of xhrsRef.current.values()) xhr.abort();
    };
    // We only want to run on unmount; entries are tracked via ref-ish closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    entries,
    add,
    remove,
    clear,
    isUploading: entries.some((e) => e.status === "uploading" || e.status === "queued"),
    successUrls: entries.filter((e) => e.url !== null).map((e) => e.url!),
  };
}
