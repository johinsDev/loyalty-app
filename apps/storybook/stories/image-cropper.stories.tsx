import { ImageCropper } from "@loyalty/ui";
import { StrictMode, useEffect, useState } from "react";

const meta = {
  title: "Components/ImageCropper",
  component: ImageCropper,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;

/** Paint a demo "logo" onto a canvas and hand it over as a File — the story
 *  needs a real File like the Dropzone produces. */
function useDemoFile(): File | null {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 800, 500);
    grad.addColorStop(0, "#1BAD9D");
    grad.addColorStop(1, "#7c5cff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 500);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 120px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("T4", 400, 250);
    canvas.toBlob((blob) => {
      if (blob) setFile(new File([blob], "demo-logo.png", { type: "image/png" }));
    }, "image/png");
  }, []);
  return file;
}

function Demo({
  cropShape = "rect",
  aspect = 1,
}: {
  cropShape?: "rect" | "round";
  aspect?: number;
}) {
  const file = useDemoFile();
  if (!file) return null;
  return (
    // StrictMode on purpose: both apps run with reactStrictMode, whose
    // simulated dev remount is exactly what broke the object-URL lifecycle
    // (mask over a blank image). The story must match those conditions.
    <StrictMode>
      <div className="max-w-md">
        <ImageCropper
          file={file}
          aspect={aspect}
          cropShape={cropShape}
          confirmLabel="Usar logo"
          cancelLabel="Cancelar"
          fitLabel="Encuadrar"
          fillLabel="Llenar"
          onCropped={() => {}}
          onCancel={() => {}}
        />
      </div>
    </StrictMode>
  );
}

export const Square = { render: () => <Demo /> };
export const RoundAvatar = { render: () => <Demo cropShape="round" aspect={1} /> };
