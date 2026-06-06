"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@loyalty/ui";
import { useForm } from "react-hook-form";

import { FileUpload } from "./file-upload";
import { RHFFileUpload } from "./rhf-file-upload";

interface AvatarForm {
  avatar: string[];
}

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

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Storage smoke</h1>
      </header>

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
