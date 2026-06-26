"use client";

import {
  Button,
  ColorPicker,
  Dialog,
  DialogContent,
  DialogTitle,
  ImageCropper,
  Input,
  Label,
  Textarea,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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

  const onSave = () =>
    update.mutate({
      name: name || undefined,
      description,
      logoUrl: logoUrl ?? "",
      brandColor,
      socialLinks: social as Record<Social, string>,
      termsPdfUrl: termsPdfUrl ?? "",
    });

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
              {SOCIALS.map((s) => (
                <Input
                  key={s}
                  value={social[s] ?? ""}
                  onChange={(e) => setSocial((cur) => ({ ...cur, [s]: e.target.value }))}
                  placeholder={s === "whatsapp" ? "+57…" : `https://… (${s})`}
                  className="h-10"
                />
              ))}
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

/** Logo upload with a square crop step. */
function LogoField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const t = useTranslations("Settings");
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const upload = useFileUpload({
    onSuccess: (entry) => {
      if (entry.url) onChange(entry.url);
      setFile(null);
    },
    onError: () => setFile(null),
  });

  return (
    <div className="flex items-center gap-3">
      <div className="bg-muted border-border grid size-16 place-items-center overflow-hidden rounded-2xl border">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="logo" className="size-full object-cover" />
        ) : (
          <ImagePlus className="text-muted-foreground size-5" />
        )}
      </div>
      <Button
        variant="outline"
        className="h-10 rounded-xl"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isUploading}
      >
        {value ? t("brand.logoChange") : t("brand.logoUpload")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          e.target.value = "";
        }}
      />
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
    </div>
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
        <Label className="text-xs">{label}</Label>
        {hint ? <span className="text-muted-foreground/70 text-xs font-semibold">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
