"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@loyalty/ui";
import Image from "next/image";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FileUpload } from "./file-upload";
import { RHFFileUpload } from "./rhf-file-upload";

interface AvatarForm {
  avatar: string[];
}

// A known public R2 object, so the demo shows a transformed image without
// uploading first. Swap/remove freely — it's only used on this dev page.
const DEMO_SRC = "https://images.t4diverclub.app/demo.jpg";

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
  const [uploaded, setUploaded] = useState<string[]>([]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Storage smoke</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>0. Image transform — upload → next/image</CardTitle>
          <CardDescription>
            The full flow: upload with our <code>&lt;FileUpload&gt;</code> +{" "}
            <code>@loyalty/storage</code>, then render the result through{" "}
            <code>next/image</code>. In <strong>prod</strong> the custom loader
            rewrites the R2 src to the API Worker&apos;s <code>/img</code>{" "}
            endpoint (resized webp/avif). Open DevTools → Network and check the
            request goes to <code>api.t4diverclub.app/img/…</code> with{" "}
            <code>content-type: image/avif</code> (or webp). In dev/preview the
            loader is a no-op (Next default optimizer).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FileUpload
            value={uploaded}
            onChange={setUploaded}
            accept={{ "image/*": [] }}
            maxFiles={1}
            maxSize={5 * 1024 * 1024}
            label="Subí una imagen"
            description="JPG/PNG hasta 5MB — se muestra abajo vía next/image"
          />

          {uploaded[0] ? (
            <figure className="space-y-2">
              <figcaption className="text-sm font-medium">
                Your upload (via next/image, w=400):
              </figcaption>
              <div className="relative h-64 w-full max-w-md overflow-hidden rounded-md border bg-muted">
                <Image
                  src={uploaded[0]}
                  alt="Uploaded preview"
                  fill
                  sizes="400px"
                  className="object-contain"
                />
              </div>
              <p className="break-all text-xs text-muted-foreground">
                src: {uploaded[0]}
              </p>
            </figure>
          ) : null}

          <figure className="space-y-2">
            <figcaption className="text-sm font-medium">
              Static demo (<code>demo.jpg</code>, w=400):
            </figcaption>
            <div className="relative h-64 w-full max-w-md overflow-hidden rounded-md border bg-muted">
              <Image
                src={DEMO_SRC}
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
