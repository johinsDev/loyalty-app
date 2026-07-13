"use client";

import * as React from "react";
import Cropper, { type Area } from "react-easy-crop";

import { cn } from "../../cn";
import { Button } from "./button";
import { Spinner } from "./spinner";

/**
 * Reusable image cropper: pan/zoom a crop of the picked `file` at a fixed
 * `aspect`, render it to a downscaled blob, and hand it back via `onCropped`.
 * Pure UI — it never uploads; the caller persists the blob (set `busy` while it
 * does). Labels are passed as props (no i18n coupling). Used for the brand logo
 * (square) and reusable for avatars (round).
 */
export function ImageCropper({
  file,
  aspect = 1,
  cropShape = "rect",
  outputWidth = 512,
  outputType = "image/webp",
  confirmLabel,
  cancelLabel,
  busyLabel,
  busy = false,
  className,
  onCropped,
  onCancel,
}: {
  file: File;
  aspect?: number;
  cropShape?: "rect" | "round";
  outputWidth?: number;
  outputType?: string;
  confirmLabel: string;
  cancelLabel: string;
  busyLabel?: string;
  busy?: boolean;
  className?: string;
  onCropped: (blob: Blob) => void;
  onCancel: () => void;
}) {
  // The object URL must be minted INSIDE the effect: with a lazy-useState +
  // revoke-on-unmount, React StrictMode's simulated remount (dev) revokes the
  // URL while the preserved state still points at it — the cropper then shows
  // its mask over a blank image. The effect re-runs on remount and mints a
  // fresh URL each time.
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [area, setArea] = React.useState<Area | null>(null);
  const [working, setWorking] = React.useState(false);

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onConfirm = async () => {
    if (!area || !imageUrl) return;
    setWorking(true);
    try {
      onCropped(await cropToBlob(imageUrl, area, aspect, outputWidth, outputType));
    } finally {
      setWorking(false);
    }
  };

  const isBusy = busy || working;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="bg-muted relative h-64 w-full overflow-hidden rounded-2xl">
        {imageUrl ? (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_: Area, px: Area) => setArea(px)}
          />
        ) : null}
      </div>
      <input
        type="range"
        min={1}
        max={3}
        step={0.01}
        value={zoom}
        onChange={(e) => setZoom(Number(e.target.value))}
        aria-label="zoom"
        className="accent-primary w-full"
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" className="h-10 rounded-xl" onClick={onCancel} disabled={isBusy}>
          {cancelLabel}
        </Button>
        <Button
          className="h-10 gap-2 rounded-xl"
          onClick={() => void onConfirm()}
          disabled={isBusy || !area}
        >
          {isBusy ? (
            <>
              <Spinner className="size-4" />
              {busyLabel ?? confirmLabel}
            </>
          ) : (
            confirmLabel
          )}
        </Button>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("image load failed")));
    img.src = src;
  });
}

async function cropToBlob(
  src: string,
  area: Area,
  aspect: number,
  outputWidth: number,
  type: string,
): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = Math.round(outputWidth / aspect);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      type,
      0.9,
    );
  });
}
