"use client";

import { updateBrandingInputSchema } from "@loyalty/api/features/settings/schemas";
import {
  Button,
  ColorPicker,
  Dialog,
  DialogContent,
  DialogTitle,
  Dropzone,
  DropzoneArea,
  DropzoneDescription,
  DropzoneIcon,
  DropzoneLabel,
  DropzoneRejections,
  ImageCropper,
  Input,
  InputPhone,
  Label,
  Textarea,
  UrlInput,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FileUpload } from "@/features/storage/components/file-upload";
import { useFileUpload } from "@/features/storage/hooks/use-file-upload";
import { useTRPC } from "@/lib/trpc/client";

const SOCIALS = ["instagram", "whatsapp", "facebook", "tiktok", "x", "website"] as const;
type Social = (typeof SOCIALS)[number];

/**
 * Brand settings — name, description, logo (upload + square crop), brand color
 * (re-themes both apps), social links and a Terms & Conditions PDF. Wired to
 * `settings.branding` / `settings.updateBranding`.
 */
export function BrandSection() {
  const t = useTranslations("Settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.settings.branding.queryOptions());

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#1BAD9D");
  const [social, setSocial] = useState<Record<string, string>>({});
  const [termsPdfUrl, setTermsPdfUrl] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (data && !seeded) {
      setName(data.name);
      setDescription(data.description ?? "");
      setLogoUrl(data.logoUrl);
      setBrandColor(data.brandColor ?? "#1BAD9D");
      setSocial(data.socialLinks ?? {});
      setTermsPdfUrl(data.termsPdfUrl ?? null);
      setSeeded(true);
    }
  }, [data, seeded]);

  const update = useMutation(
    trpc.settings.updateBranding.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.settings.branding.queryFilter());
        toast.success(t("saved"));
      },
      onError: () => toast.error(t("brand.error")),
    }),
  );

  const onSave = () => {
    const payload = {
      name: name || undefined,
      description,
      logoUrl: logoUrl ?? "",
      brandColor,
      socialLinks: social as Record<Social, string>,
      termsPdfUrl: termsPdfUrl ?? "",
    };
    // Validate against the shared server schema before saving (catches a bad
    // color / URL in-form instead of a server error).
    const parsed = updateBrandingInputSchema.safeParse(payload);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? "");
      toast.error(field ? t("brand.invalidField", { field }) : t("brand.invalidData"));
      return;
    }
    update.mutate(parsed.data);
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{t("brand.title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("brand.desc")}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label={t("brand.name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("brand.namePlaceholder")}
              className="h-10"
            />
          </Field>
          <Field label={t("brand.description")}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("brand.descriptionPlaceholder")}
              className="min-h-20"
            />
          </Field>
          <Field label={t("brand.logo")} hint={t("brand.logoHint")}>
            <LogoField value={logoUrl} onChange={setLogoUrl} />
          </Field>
          <Field label={t("brand.color")}>
            <ColorPicker value={brandColor} onValueChange={setBrandColor} />
          </Field>
        </div>

        <div className="space-y-4">
          <Field label={t("brand.social")}>
            <div className="space-y-2">
              {SOCIALS.map((s) =>
                s === "whatsapp" ? (
                  <InputPhone
                    key={s}
                    size="sm"
                    value={social[s] ?? ""}
                    onChange={(v) => setSocial((cur) => ({ ...cur, [s]: v.e164 }))}
                  />
                ) : (
                  <UrlInput
                    key={s}
                    value={social[s] ?? ""}
                    onChange={(v) => setSocial((cur) => ({ ...cur, [s]: v }))}
                    placeholder={`… (${s})`}
                  />
                ),
              )}
            </div>
          </Field>
          <Field label={t("brand.terms")}>
            <FileUpload
              value={termsPdfUrl ? [termsPdfUrl] : []}
              onChange={(urls) => setTermsPdfUrl(urls[urls.length - 1] ?? null)}
              accept={{ "application/pdf": [".pdf"] }}
              multiple={false}
            />
          </Field>
        </div>
      </div>

      <Button className="h-10 rounded-xl font-semibold" onClick={onSave} disabled={update.isPending}>
        {t("save")}
      </Button>
    </section>
  );
}

/**
 * Logo upload — a large drag-and-drop zone (mirrors the T&C dropzone) that opens
 * a square crop step before uploading to the default disk via `useFileUpload`.
 */
function LogoField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const t = useTranslations("Settings");
  const [file, setFile] = useState<File | null>(null);

  const upload = useFileUpload({
    onSuccess: (entry) => {
      if (entry.url) onChange(entry.url);
      setFile(null);
    },
    onError: () => setFile(null),
  });

  return (
    <>
      <Dropzone
        accept={{ "image/*": [] }}
        multiple={false}
        disabled={upload.isUploading}
        onDrop={(files) => {
          const f = files[0];
          if (f) setFile(f);
        }}
      >
        {value ? (
          <div className="group/logo border-border bg-muted/30 relative flex min-h-44 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-4 transition-colors hover:border-muted-foreground/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="logo" className="max-h-36 max-w-full rounded-xl object-contain" />
            <div className="bg-foreground/0 pointer-events-none absolute inset-0 flex items-center justify-center transition-colors group-hover/logo:bg-foreground/40">
              <span className="bg-background/90 rounded-lg px-3 py-1.5 text-sm font-medium opacity-0 shadow-sm transition-opacity group-hover/logo:opacity-100">
                {t("brand.logoChange")}
              </span>
            </div>
            <button
              type="button"
              aria-label={t("brand.imgRemove")}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="bg-background/90 text-muted-foreground hover:text-foreground absolute right-2 top-2 grid size-7 place-items-center rounded-full shadow-sm"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ) : (
          <DropzoneArea className="min-h-44">
            <DropzoneIcon />
            <DropzoneLabel>{t("brand.logoUpload")}</DropzoneLabel>
            <DropzoneDescription>{t("brand.logoHint")}</DropzoneDescription>
          </DropzoneArea>
        )}
        <DropzoneRejections />
      </Dropzone>
      <Dialog open={Boolean(file)} onOpenChange={(o) => !o && setFile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{t("brand.logoCrop")}</DialogTitle>
          {file ? (
            <ImageCropper
              file={file}
              aspect={1}
              outputWidth={512}
              confirmLabel={t("brand.logoCropConfirm")}
              cancelLabel={t("cancel")}
              fitLabel={t("brand.cropFit")}
              fillLabel={t("brand.cropFill")}
              busyLabel={t("brand.logoUploading")}
              busy={upload.isUploading}
              onCropped={(blob) =>
                upload.add([new File([blob], "logo.webp", { type: "image/webp" })])
              }
              onCancel={() => setFile(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        {hint ? <span className="text-muted-foreground/70 text-xs font-semibold">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
