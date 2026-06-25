"use client";

import { Button, Spinner } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { useFileUpload } from "@/features/storage/hooks/use-file-upload";
import { AVATAR_MAX_BYTES } from "../data";

const OUTPUT_SIZE = 512;

/**
 * Square avatar cropper. Takes the file the user picked, lets them pan/zoom a
 * 1:1 crop, then renders the selected area to a 512×512 WEBP and uploads it via
 * `useFileUpload`. Calls `onUploaded` with the signed URL + thumbhash so the
 * caller can persist it with `profile.updateAvatar`.
 */
export function AvatarCropper({
  file,
  onUploaded,
  onCancel,
}: {
  file: File;
  onUploaded: (result: { url: string; thumbhash: string | null }) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Profile");
  const [imageUrl] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  // The Worker's StorageManager only registers a `default` disk (see
  // apps/api/src/lib/storage.ts) — there's no `public` disk, so we omit `disk`
  // and let it resolve to the default (which is public when R2_PUBLIC_URL is set).
  const upload = useFileUpload({
    maxSize: AVATAR_MAX_BYTES,
    onSuccess: (entry) => {
      if (entry.url) onUploaded({ url: entry.url, thumbhash: entry.thumbhash });
    },
    onError: () => setWorking(false),
  });

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const onConfirm = async () => {
    if (!croppedAreaPixels) return;
    setWorking(true);
    try {
      const blob = await cropToWebp(imageUrl, croppedAreaPixels);
      const cropped = new File([blob], "avatar.webp", { type: "image/webp" });
      upload.add([cropped]);
    } catch {
      setWorking(false);
    }
  };

  const busy = working || upload.isUploading;

  return (
    <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {t("avatarCropTitle")}
      </h2>
      <div className="relative mt-4 h-64 w-full overflow-hidden rounded-3xl bg-black">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <input
        type="range"
        min={1}
        max={3}
        step={0.01}
        value={zoom}
        onChange={(event) => setZoom(Number(event.target.value))}
        aria-label={t("avatarCropTitle")}
        className="accent-primary mt-4 w-full"
      />
      <div className="mt-5 flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={onCancel}
          disabled={busy}
          className="h-14 flex-1 rounded-full text-base font-semibold"
        >
          {t("cancel")}
        </Button>
        <Button
          variant="gradient"
          size="lg"
          onClick={() => void onConfirm()}
          disabled={busy || !croppedAreaPixels}
          className="h-14 flex-1 gap-2 rounded-full text-base font-semibold"
        >
          {busy ? (
            <>
              <Spinner className="size-5" />
              {t("avatarUploading")}
            </>
          ) : (
            t("avatarCropConfirm")
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

async function cropToWebp(src: string, area: Area): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/webp",
      0.9,
    );
  });
}
