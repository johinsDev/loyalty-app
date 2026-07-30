"use client";

import {
  Button,
  Dropzone,
  DropzoneArea,
  DropzoneDescription,
  DropzoneIcon,
  DropzoneLabel,
  DropzoneRejections,
  Progress,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
  Separator,
  Spinner,
} from "@loyalty/ui";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useFileUpload } from "@/features/storage/hooks/use-file-upload";

const MAX_SIZE = 5 * 1024 * 1024;

export interface VariantImagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The product's photos, in gallery order (emoji-only media is excluded). */
  photos: { id: string; url: string }[];
  /** The media id the open variant currently points at. */
  selectedId: string | null;
  /** Pick a photo, or `null` to unlink the variant's image. */
  onSelect: (mediaId: string | null) => void;
  /** A freshly uploaded image — the parent appends it and selects it. */
  onUploaded: (url: string) => void;
  /** Drop a photo from the product entirely (the parent offers undo). */
  onDeletePhoto: (mediaId: string) => void;
}

/**
 * Variant image picker — the current selection on top (drop or click to
 * replace, ✕ to unlink), then the product's photos as a grid where a tile
 * selects and its hover ✕ deletes the photo from the product.
 */
export function VariantImagePicker({
  open,
  onOpenChange,
  photos,
  selectedId,
  onSelect,
  onUploaded,
  onDeletePhoto,
}: VariantImagePickerProps) {
  const t = useTranslations("Products");
  const upload = useFileUpload({
    accept: { "image/*": [] },
    maxSize: MAX_SIZE,
    onSuccess: (entry) => {
      if (entry.url) onUploaded(entry.url);
    },
    onError: () => toast.error(t("mediaUploadError")),
  });

  const selected = photos.find((p) => p.id === selectedId) ?? null;
  // Only the in-flight entry drives the progress block; finished ones are
  // already product photos.
  const pending =
    upload.entries.filter((e) => e.status === "queued" || e.status === "uploading").at(-1) ??
    null;
  const progress = pending?.progress ?? 0;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <div className="flex flex-col px-6 pt-2 pb-6">
          <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
            {t("variantImageTitle")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
            {t("variantImageSubtitle")}
          </ResponsiveModalDescription>

          <div className="mt-4">
            <Dropzone
              accept={{ "image/*": [] }}
              multiple={false}
              maxSize={MAX_SIZE}
              disabled={upload.isUploading}
              onDrop={(files) => {
                const file = files[0];
                if (file) upload.add([file]);
              }}
            >
              {upload.isUploading ? (
                <div className="border-primary/40 bg-primary/5 flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6">
                  <Spinner className="text-primary size-6" />
                  <p className="text-primary text-sm font-bold">
                    {t("variantImageUploadingPct", { pct: progress })}
                  </p>
                  <Progress value={progress} className="w-full max-w-52" />
                </div>
              ) : selected ? (
                <div className="group/sel border-border bg-muted/30 hover:border-muted-foreground/50 relative flex min-h-40 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-4 transition-colors">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.url}
                    alt=""
                    className="max-h-32 max-w-full rounded-xl object-contain"
                  />
                  <div className="bg-foreground/0 group-hover/sel:bg-foreground/40 pointer-events-none absolute inset-0 flex items-center justify-center transition-colors">
                    <span className="bg-background/90 rounded-lg px-3 py-1.5 text-sm font-medium opacity-0 shadow-sm transition-opacity group-hover/sel:opacity-100">
                      {t("variantImageChange")}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={t("variantImageUnlink")}
                    onClick={(e) => {
                      // The button sits inside the Dropzone root, which opens the
                      // file dialog on click — don't let it bubble.
                      e.stopPropagation();
                      onSelect(null);
                    }}
                    className="bg-background/90 text-muted-foreground hover:text-foreground absolute top-2 right-2 grid size-7 place-items-center rounded-full shadow-sm"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <DropzoneArea className="min-h-40">
                  <DropzoneIcon />
                  <DropzoneLabel>{t("variantImageUpload")}</DropzoneLabel>
                  <DropzoneDescription>{t("mediaFormats")}</DropzoneDescription>
                </DropzoneArea>
              )}
              <DropzoneRejections />
            </Dropzone>
          </div>

          <Separator className="my-5" />

          <p className="text-muted-foreground text-xs font-bold uppercase">
            {t("variantImageProductPhotos")}
          </p>
          {photos.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-xs font-semibold">
              {t("variantImageEmpty")}
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-4 gap-2.5">
              {photos.map((photo) => {
                const active = photo.id === selectedId;
                return (
                  <div key={photo.id} className="group/tile relative">
                    <button
                      type="button"
                      onClick={() => onSelect(photo.id)}
                      className={`grid aspect-square w-full place-items-center overflow-hidden rounded-xl border ${
                        active ? "border-primary border-2" : "border-border"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="size-full object-cover" />
                    </button>
                    {active ? (
                      <span className="bg-primary text-primary-foreground absolute bottom-1 left-1 grid size-4 place-items-center rounded-full">
                        <Check className="size-2.5" />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={t("delete")}
                      onClick={() => onDeletePhoto(photo.id)}
                      className="bg-card text-destructive absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border opacity-0 group-hover/tile:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <Button
            className="mt-5 h-10 w-full rounded-xl font-semibold"
            onClick={() => onOpenChange(false)}
          >
            {t("done")}
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
