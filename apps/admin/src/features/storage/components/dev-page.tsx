"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@loyalty/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { LoyaltyImage } from "@/components/loyalty-image";

import { FileUpload } from "./file-upload";
import { RHFFileUpload } from "./rhf-file-upload";

interface AvatarForm {
  avatar: string[];
}

// A known public R2 object + its precomputed thumbhash, so the demo shows a
// transformed image WITH blur-up without uploading first.
const DEMO_SRC = "https://images.t4diverclub.app/demo.jpg";
const DEMO_THUMBHASH = "GAgKLYR1d3ePd4h0eGiIhIaAZwho";

type Uploaded = { url: string; thumbhash: string | null };

/**
 * Smoke surface for the storage channel. Three demos:
 *
 *   1. RHF Controller — single image avatar wired into react-hook-form;
 *      submit prints the form value.
 *   2. Multi-file — up to 5 docs with progress bars.
 *   3. Pure Dropzone — disabled, just the UI states.
 *
 * Gated by the `(dev)` layout (returns 404 in production). Uploads go through
 * the standalone API Worker, which owns the storage provider.
 */
export function StorageDevPage() {
  const form = useForm<AvatarForm>({ defaultValues: { avatar: [] } });
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Storage smoke</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>0. Image transform + blur-up — upload → &lt;LoyaltyImage&gt;</CardTitle>
          <CardDescription>
            The full flow: upload with our <code>&lt;FileUpload&gt;</code> +{" "}
            <code>@loyalty/storage</code> (which computes a <strong>thumbhash</strong>{" "}
            blur in the browser at upload), then render via{" "}
            <code>&lt;LoyaltyImage&gt;</code> — it decodes the thumbhash into a{" "}
            <code>blurDataURL</code> for a deterministic blur-up (no extra
            fetch). In <strong>prod</strong> the loader rewrites the R2 src to the
            Worker&apos;s <code>/img</code> endpoint (resized webp/avif,{" "}
            <code>fit=scale-down</code> so it never upscales). DevTools → Network:
            the request goes to <code>api.t4diverclub.app/img/…</code> with{" "}
            <code>content-type: image/avif</code>. Dev/preview: loader no-op.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FileUpload
            value={null}
            onUploaded={(e) =>
              e.url && setUploaded({ url: e.url, thumbhash: e.thumbhash })
            }
            accept={{ "image/*": [] }}
            maxFiles={1}
            maxSize={5 * 1024 * 1024}
            label="Subí una imagen"
            description="JPG/PNG hasta 5MB — se muestra abajo con blur-up"
          />

          {uploaded ? (
            <figure className="space-y-2">
              <figcaption className="text-sm font-medium">
                Your upload (blur-up via &lt;LoyaltyImage&gt;, w=400):
              </figcaption>
              <div className="relative h-64 w-full max-w-md overflow-hidden rounded-md border bg-muted">
                <LoyaltyImage
                  src={uploaded.url}
                  thumbhash={uploaded.thumbhash}
                  alt="Uploaded preview"
                  fill
                  sizes="400px"
                  className="object-contain"
                />
              </div>
              <p className="break-all text-xs text-muted-foreground">
                src: {uploaded.url} · thumbhash: {uploaded.thumbhash ?? "—"}
              </p>
            </figure>
          ) : null}

          <figure className="space-y-2">
            <figcaption className="text-sm font-medium">
              Static demo (<code>demo.jpg</code> + precomputed thumbhash, w=400):
            </figcaption>
            <div className="relative h-64 w-full max-w-md overflow-hidden rounded-md border bg-muted">
              <LoyaltyImage
                src={DEMO_SRC}
                thumbhash={DEMO_THUMBHASH}
                alt="Demo image"
                fill
                sizes="400px"
                className="object-contain"
              />
            </div>
          </figure>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. Avatar (RHF Controller)</CardTitle>
          <CardDescription>
            Single image, plugged into <code>react-hook-form</code> via{" "}
            <code>&lt;RHFFileUpload&gt;</code>. Submit to see the form value.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((values) => {
              alert(JSON.stringify(values, null, 2));
            })}
          >
            <RHFFileUpload
              name="avatar"
              control={form.control}
              accept={{ "image/*": [] }}
              maxFiles={1}
              maxSize={5 * 1024 * 1024}
              label="Subí tu avatar"
              description="JPG, PNG hasta 5MB"
            />
            <Button type="submit" disabled={!form.formState.isValid && form.formState.isSubmitted}>
              Submit
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Multi-file (controlled)</CardTitle>
          <CardDescription>
            Up to 5 documents in parallel. Watch the progress bars.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            value={null}
            multiple
            maxFiles={5}
            maxSize={20 * 1024 * 1024}
            label="Subí varios documentos"
            description="Hasta 5 archivos, 20MB cada uno"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Pure Dropzone</CardTitle>
          <CardDescription>
            The primitive without the upload logic — drag a file, watch
            the hover/accept/reject states. Drop is a no-op here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload value={null} disabled label="Solo UI" description="Disabled = no upload" />
        </CardContent>
      </Card>
    </main>
  );
}
