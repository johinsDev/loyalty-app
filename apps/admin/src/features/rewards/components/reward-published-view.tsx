"use client";

import { rewardBenefitSummary } from "@loyalty/api/features/rewards/format";
import {
  BackgroundPicker,
  Badge,
  Button,
  IconPicker,
  Input,
  Label,
  NumberInput,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  RichTextEditor,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronLeft, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FileUpload } from "@/features/storage/components/file-upload";
import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { Link, useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { RewardPreview } from "./reward-wizard";

const REWARD_EMOJIS = ["🎁", "🧋", "🍮", "⬆️", "✨", "⚡", "🎂", "⭐"];

type ContentForm = {
  backgroundCss: string;
  imageUrl: string | null;
  icon: string;
  description: string;
  fulfillmentNote: string;
  sections: string[];
  sortOrder: number;
};

/**
 * Published/archived reward screen: mechanics + cost are immutable (archive and
 * recreate to change them); only design/copy stays editable via `patchContent`.
 */
export function RewardPublishedView({ id }: { id: string }) {
  const t = useTranslations("Rewards");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();

  const rewardQuery = useQuery(trpc.rewards.getAdmin.queryOptions({ id }));
  const campaigns = useQuery(
    trpc.campaigns.campaignsBySource.queryOptions({ scope: "reward", id }),
  );
  const patchMut = useMutation(trpc.rewards.patchContent.mutationOptions());
  const archiveMut = useMutation(trpc.rewards.archive.mutationOptions());

  const [form, setForm] = useState<ContentForm | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [sectionDraft, setSectionDraft] = useState("");
  const seeded = useRef(false);

  const reward = rewardQuery.data;
  useEffect(() => {
    if (!reward || seeded.current) return;
    setForm({
      backgroundCss: reward.backgroundCss ?? "",
      imageUrl: reward.imageUrl,
      icon: reward.icon ?? "",
      description: reward.description ?? "",
      fulfillmentNote: reward.fulfillmentNote ?? "",
      sections: reward.sections ?? [],
      sortOrder: reward.sortOrder ?? 0,
    });
    seeded.current = true;
  }, [reward]);

  if (!reward || !form) return null;

  const summary = rewardBenefitSummary(reward.benefit, locale === "en" ? "en" : "es");
  const costLine = [
    reward.stampsRequired != null ? t("cost.stamps", { n: reward.stampsRequired }) : null,
    reward.pointsCost != null ? t("cost.points", { n: reward.pointsCost }) : null,
  ]
    .filter(Boolean)
    .join(reward.costMode === "and" ? t("cost.and") : t("cost.or"));
  const set = <K extends keyof ContentForm>(key: K, value: ContentForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const addSection = () => {
    const s = sectionDraft.trim().slice(0, 60);
    if (s && !form.sections.includes(s)) set("sections", [...form.sections, s]);
    setSectionDraft("");
  };

  async function save() {
    if (!form) return;
    try {
      await patchMut.mutateAsync({
        id,
        backgroundCss: form.backgroundCss,
        imageUrl: form.imageUrl ?? "",
        icon: form.icon || null,
        description: form.description || null,
        fulfillmentNote: form.fulfillmentNote || null,
        sections: form.sections,
        sortOrder: form.sortOrder,
      });
      await queryClient.invalidateQueries(trpc.rewards.getAdmin.queryFilter({ id }));
      toast.success(t("updated", { name: reward?.name ?? "" }));
    } catch {
      toast.error(t("saveError"));
    }
  }

  async function archive() {
    try {
      await archiveMut.mutateAsync({ id });
      await queryClient.invalidateQueries(trpc.rewards.adminList.queryFilter());
      toast.success(t("archived", { name: reward?.name ?? "" }));
      router.push("/rewards");
    } catch {
      toast.error(t("archiveError"));
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <button
        type="button"
        onClick={() => router.push("/rewards")}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        <ChevronLeft className="size-4" />
        {t("title")}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{reward.name}</h1>
          <Badge variant={reward.status === "published" ? "default" : "secondary"}>
            {t(`status.${reward.status}`)}
          </Badge>
        </div>
        {reward.status === "published" ? (
          <Button
            variant="outline"
            className="h-10 gap-1.5 rounded-xl"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="size-4" />
            {t("archive")}
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground mt-1 text-sm">{t("publishedImmutableHint")}</p>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-card border-border space-y-4 rounded-3xl border p-6 shadow-sm lg:col-span-2">
          <div className="bg-muted/40 grid grid-cols-1 gap-3 rounded-xl px-3 py-2 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                {t("reviewBenefit")}
              </p>
              <p className="text-sm font-semibold">{summary ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                {t("reviewCost")}
              </p>
              <p className="text-sm font-semibold">{costLine || "—"}</p>
            </div>
          </div>

          <Field label={t("fieldBg")}>
            <BackgroundPicker
              value={form.backgroundCss}
              onValueChange={(bg) => set("backgroundCss", bg)}
              onUploadImage={uploadImage}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("fieldIcon")}>
              <IconPicker
                value={form.icon}
                onValueChange={(e) => set("icon", e)}
                emojis={REWARD_EMOJIS}
                customLabel={t("iconCustom")}
                uploadLabel={t("imgUpload")}
                removeLabel={t("imgRemove")}
              />
            </Field>
            <Field label={t("fieldMainImage")} hint={t("optional")}>
              <FileUpload
                value={form.imageUrl ? [form.imageUrl] : []}
                onChange={(urls) => set("imageUrl", urls[urls.length - 1] ?? null)}
                accept={{ "image/*": [] }}
                multiple={false}
              />
            </Field>
          </div>
          <Field label={t("fieldDescription")} hint={t("optional")}>
            <RichTextEditor
              value={form.description}
              onValueChange={(html) => set("description", html)}
            />
          </Field>
          {reward.type === "experience" ? (
            <Field label={t("fieldFulfillment")} hint={t("fulfillmentHint")}>
              <Input
                value={form.fulfillmentNote}
                onChange={(e) => set("fulfillmentNote", e.target.value)}
                className="h-10"
              />
            </Field>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("cost.sections")} hint={t("cost.sectionsHint")}>
              <div className="space-y-2">
                {form.sections.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {form.sections.map((s) => (
                      <span
                        key={s}
                        className="bg-muted inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold"
                      >
                        {s}
                        <button
                          type="button"
                          aria-label={t("cost.removeSection")}
                          onClick={() => set("sections", form.sections.filter((x) => x !== s))}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <Input
                  value={sectionDraft}
                  onChange={(e) => setSectionDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSection();
                    }
                  }}
                  onBlur={addSection}
                  placeholder={t("cost.sectionsPlaceholder")}
                  className="h-10"
                />
              </div>
            </Field>
            <Field label={t("cost.sortOrder")} hint={t("cost.sortOrderHint")}>
              <NumberInput
                value={form.sortOrder}
                onValueChange={(v) => set("sortOrder", v ?? 0)}
                className="h-10 w-28"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button
              className="h-10 rounded-xl px-6 font-semibold"
              onClick={save}
              disabled={patchMut.isPending}
            >
              {t("saveChanges")}
            </Button>
          </div>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <RewardPreview
            name={reward.name}
            icon={form.icon}
            description={form.description || summary || ""}
            backgroundCss={form.backgroundCss}
            imageUrl={form.imageUrl}
            stampsRequired={reward.stampsRequired ?? undefined}
            pointsCost={reward.pointsCost ?? undefined}
            costMode={(reward.costMode as "or" | "and") ?? "or"}
          />

          <section className="bg-card border-border rounded-3xl border p-5 shadow-sm">
            <h3 className="font-display mb-3 text-sm font-semibold">
              {t("campaigns.title", { n: campaigns.data?.length ?? 0 })}
            </h3>
            {campaigns.isPending ? (
              <div className="bg-muted/50 h-5 w-40 animate-pulse rounded" />
            ) : campaigns.data && campaigns.data.length > 0 ? (
              <ul className="divide-border divide-y">
                {campaigns.data.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <Link
                      href={{ pathname: "/campaigns/[id]", params: { id: c.id } }}
                      className="text-sm hover:underline"
                    >
                      {c.name ?? t("campaigns.untitled")}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {t(`campaigns.status.${c.status === "published" ? "published" : "draft"}`)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t("campaigns.empty")}</p>
            )}
          </section>
        </aside>
      </div>

      <ResponsiveModal open={archiveOpen} onOpenChange={setArchiveOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("archiveTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">{t("archiveDescription")}</p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setArchiveOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full px-6 font-semibold"
              onClick={archive}
              disabled={archiveMut.isPending}
            >
              {t("archive")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
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
