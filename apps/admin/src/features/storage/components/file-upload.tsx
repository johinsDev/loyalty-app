"use client";

import {
  Dropzone,
  DropzoneArea,
  DropzoneDescription,
  DropzoneIcon,
  DropzoneLabel,
  DropzoneList,
  DropzoneListItem,
  DropzoneRejections,
} from "@loyalty/ui";
import { useEffect } from "react";
import type { Accept } from "react-dropzone";

import {
  useFileUpload,
  type FileUploadEntry,
} from "../hooks/use-file-upload";

/** Best-effort filename for a stored URL (drops query string). */
function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url, "https://x").pathname;
    return decodeURIComponent(path.split("/").pop() || "archivo");
  } catch {
    return "archivo";
  }
}

interface FileUploadProps {
  /** Currently-stored URLs. Pass an empty array to start fresh. */
  value: string[] | null | undefined;
  /** Fired every time the set of successful URLs changes. */
  onChange?: (urls: string[]) => void;
  /** Fired once per file on success, with the full entry (url + thumbhash). */
  onUploaded?: (entry: FileUploadEntry) => void;
  accept?: Accept;
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  disk?: string;
  label?: string;
  description?: string;
  className?: string;
}

/**
 * Connected file upload. Composes the headless `Dropzone` primitives
 * from `@loyalty/ui` with `useFileUpload` (which talks to tRPC +
 * `@loyalty/storage`). Pass `value` + `onChange` to plug it into a
 * controlled form; pre-existing URLs render as a static thumbnail
 * grid above the dropzone.
 */
export function FileUpload({
  value,
  onChange,
  onUploaded,
  accept,
  maxFiles,
  maxSize,
  multiple,
  disabled,
  disk,
  label,
  description,
  className,
}: FileUploadProps) {
  const fu = useFileUpload({
    ...(accept && { accept }),
    ...(maxSize !== undefined && { maxSize }),
    ...(disk && { disk }),
    ...(onUploaded && { onSuccess: onUploaded }),
  });

  // Bubble URL set to caller whenever entries change.
  useEffect(() => {
    if (!onChange) return;
    const existing = value ?? [];
    const fresh = fu.successUrls;
    const merged = [...existing, ...fresh];
    // Cheap dedupe + only fire when changed
    const out = Array.from(new Set(merged));
    onChange(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fu.successUrls.join("|")]);

  const isFull = maxFiles !== undefined && fu.entries.length >= maxFiles;

  // Already-saved URLs (from `value` on edit) that aren't a fresh in-session
  // upload — rendered as removable thumbnails so the stored image shows and
  // can be cleared. Removing one drops it from the caller's `value`.
  const persistedUrls = (value ?? []).filter(
    (u) => !fu.entries.some((e) => e.url === u),
  );
  const removePersisted = (url: string) =>
    onChange?.((value ?? []).filter((u) => u !== url));

  return (
    <Dropzone
      {...(accept && { accept })}
      {...(maxFiles !== undefined && { maxFiles })}
      {...(maxSize !== undefined && { maxSize })}
      {...(multiple !== undefined && { multiple })}
      disabled={disabled || isFull}
      onDrop={(files) => {
        if (files.length > 0) fu.add(files);
      }}
      {...(className && { className })}
    >
      <DropzoneArea>
        <DropzoneIcon />
        <DropzoneLabel>{label ?? "Subí o arrastrá tu archivo"}</DropzoneLabel>
        {description && <DropzoneDescription>{description}</DropzoneDescription>}
      </DropzoneArea>
      <DropzoneRejections />
      {(persistedUrls.length > 0 || fu.entries.length > 0) && (
        <DropzoneList>
          {persistedUrls.map((url) => (
            <DropzoneListItem
              key={url}
              name={fileNameFromUrl(url)}
              contentType="image/*"
              status="success"
              thumbnailUrl={url}
              onRemove={() => removePersisted(url)}
            />
          ))}
          {fu.entries.map((entry: FileUploadEntry) => {
            // Prefer the final download URL once uploaded — the blob preview
            // URL is revoked on unmount and renders broken.
            const thumb =
              entry.status === "success" && entry.url
                ? entry.url
                : (entry.previewUrl ?? entry.url);
            return (
              <DropzoneListItem
                key={entry.id}
                name={entry.file.name}
                size={entry.file.size}
                contentType={entry.file.type}
                progress={entry.progress}
                status={entry.status}
                {...(entry.error && { errorMessage: entry.error })}
                {...(thumb ? { thumbnailUrl: thumb } : {})}
                onRemove={() => fu.remove(entry.id)}
              />
            );
          })}
        </DropzoneList>
      )}
    </Dropzone>
  );
}
