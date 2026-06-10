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
      {fu.entries.length > 0 && (
        <DropzoneList>
          {fu.entries.map((entry: FileUploadEntry) => (
            <DropzoneListItem
              key={entry.id}
              name={entry.file.name}
              size={entry.file.size}
              contentType={entry.file.type}
              progress={entry.progress}
              status={entry.status}
              {...(entry.error && { errorMessage: entry.error })}
              {...(entry.previewUrl ? { thumbnailUrl: entry.previewUrl } : entry.url ? { thumbnailUrl: entry.url } : {})}
              onRemove={() => fu.remove(entry.id)}
            />
          ))}
        </DropzoneList>
      )}
    </Dropzone>
  );
}
