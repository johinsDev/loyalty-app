"use client";

import { formatDate } from "@loyalty/date";
import {
  BackgroundPicker,
  Badge,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Label,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  TimeInput,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { Bell, Check, Users, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { FileUpload } from "@/features/storage/components/file-upload";
import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { useRouter } from "@/i18n/navigation";
import { useNavigationGuard } from "@/lib/use-unsaved-guard";
import { useTRPC } from "@/lib/trpc/client";

import { CtaEntityPicker } from "./cta-entity-picker";
import { CustomerCombobox } from "./customer-combobox";

const STEPS = ["content", "design", "schedule", "review"] as const;
type Step = (typeof STEPS)[number];

const CHANNELS = ["push", "database", "realtime"] as const;
const TIERS = ["hoja", "flor", "oro"] as const;

type CtaTarget = "none" | "external" | "product" | "promo" | "reward";

type Form = {
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  ctaLabel: string;
  ctaTarget: CtaTarget;
  ctaValue: string;
  backgroundCss: string;
  mainImageUrl: string | null;
  displayFrom: Date | null;
  displayUntil: Date | null;
};

const EMPTY: Form = {
  name: "",
  slug: "",
  shortDescription: "",
  longDescription: "",
  ctaLabel: "",
  ctaTarget: "none",
  ctaValue: "",
  backgroundCss: "linear-gradient(135deg, #1BAD9D, #0e6f64)",
  mainImageUrl: null,
  displayFrom: null,
  displayUntil: null,
};

/** Reverse a stored ctaHref into the editor's target + value (a slug for
 *  product/promo). */
function parseCta(href: string | null): { ctaTarget: CtaTarget; ctaValue: string } {
  if (!href) return { ctaTarget: "none", ctaValue: "" };
  if (/^https?:\/\//i.test(href)) return { ctaTarget: "external", ctaValue: href };
  if (href.startsWith("/product/"))
    return { ctaTarget: "product", ctaValue: href.slice("/product/".length) };
  if (href.startsWith("/promos/"))
    return { ctaTarget: "promo", ctaValue: href.slice("/promos/".length) };
  if (href === "/promos") return { ctaTarget: "promo", ctaValue: "" };
  if (href === "/rewards") return { ctaTarget: "reward", ctaValue: "" };
  return { ctaTarget: "external", ctaValue: href };
}

/** Build the stored ctaHref + kind from the editor's target + value. A
 *  product/promo target deep-links to the selected entity (`value` = its slug);
 *  an empty promo value falls back to the promos list. Rewards → the list. */
function buildCta(target: CtaTarget, value: string): { href?: string; kind?: "internal" | "external" } {
  if (target === "none") return {};
  if (target === "external") return { href: value, kind: "external" };
  if (target === "product") return value ? { href: `/product/${value}`, kind: "internal" } : {};
  if (target === "promo") return { href: value ? `/promos/${value}` : "/promos", kind: "internal" };
  return { href: "/rewards", kind: "internal" };
}

/** FE slug suggestion (server re-slugs + dedupes on save). */
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Server-driven banner wizard (content → design → schedule → review). On "new"
 * it creates a draft immediately; each Next persists the step via the backend
 * `advance`, and Finish publishes. The schedule step also manages scheduled
 * notifications (Trigger.dev owns delivery).
 */
export function BannerWizard({ id }: { id?: string }) {
  const t = useTranslations("Banners");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();

  const [bannerId, setBannerId] = useState<string | undefined>(id);
  const [form, setForm] = useState<Form>(EMPTY);
  const [slugAuto, setSlugAuto] = useState(!id);
  const [stepIndex, setStepIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const seeded = useRef(false);
  const creating = useRef(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  // Guard every attempt to navigate away with unsaved edits (links + tab close).
  const bypass = useNavigationGuard(dirty, (href) => {
    setPendingHref(href);
    setExitOpen(true);
  });
  const confirmLeave = () => {
    bypass.current = true;
    setDirty(false);
    setExitOpen(false);
    if (pendingHref && pendingHref !== "__back__") window.location.href = pendingHref;
    else router.push("/banners");
  };
  const tryExit = () => {
    if (dirty) {
      setPendingHref(null);
      setExitOpen(true);
    } else {
      router.push("/banners");
    }
  };

  function seed(b: {
    name: string;
    slug: string;
    shortDescription: string | null;
    longDescription: string | null;
    ctaLabel: string | null;
    ctaHref: string | null;
    ctaKind: string | null;
    backgroundCss: string | null;
    mainImageUrl: string | null;
    displayFrom: Date | null;
    displayUntil: Date | null;
  }) {
    setForm({
      name: b.name === "Borrador" ? "" : b.name,
      slug: b.slug.startsWith("borrador-") ? "" : b.slug,
      shortDescription: b.shortDescription ?? "",
      longDescription: b.longDescription ?? "",
      ctaLabel: b.ctaLabel ?? "",
      ...parseCta(b.ctaHref),
      backgroundCss: b.backgroundCss ?? EMPTY.backgroundCss,
      mainImageUrl: b.mainImageUrl,
      displayFrom: b.displayFrom,
      displayUntil: b.displayUntil,
    });
  }

  // New banner → create a draft once.
  const createMut = useMutation(trpc.banners.create.mutationOptions());
  useEffect(() => {
    if (id || bannerId || creating.current) return;
    creating.current = true;
    createMut.mutate(undefined, {
      onSuccess: (res) => {
        setBannerId(res.banner.id);
        seeded.current = true;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, bannerId]);

  // Edit banner → load + seed once.
  const stateQuery = useQuery({
    ...trpc.banners.getState.queryOptions({ id: id ?? "" }),
    enabled: Boolean(id),
  });
  useEffect(() => {
    if (id && stateQuery.data && !seeded.current) {
      seed(stateQuery.data.banner);
      seeded.current = true;
    }
  }, [id, stateQuery.data]);

  const advanceMut = useMutation(trpc.banners.advance.mutationOptions());
  const publishMut = useMutation(trpc.banners.publish.mutationOptions());

  const step = STEPS[stepIndex]!;
  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));

  // Per-step validity (mirrors the zod schemas). Only `content` can be invalid;
  // the rest are always satisfiable. A step is reachable once every prior step is
  // valid — so in edit, where everything is filled, all steps are clickable.
  const valid: Record<Step, boolean> = {
    content:
      form.name.trim().length > 0 &&
      form.slug.trim().length > 0 &&
      form.shortDescription.trim().length > 0 &&
      // A "product" CTA must point at a specific product (no product-list page
      // to fall back to). Promo/reward can fall back to their list.
      (form.ctaTarget !== "product" || form.ctaValue.trim().length > 0),
    design: true,
    schedule: true,
    review: true,
  };
  const navigable: string[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS.slice(0, i).every((s) => valid[s])) navigable.push(STEPS[i]!);
  }
  const completed = STEPS.slice(0, stepIndex).filter((s) => valid[s]);

  async function persistStep(): Promise<boolean> {
    if (!bannerId) return false;
    try {
      if (step === "content") {
        const cta = buildCta(form.ctaTarget, form.ctaValue);
        await advanceMut.mutateAsync({
          id: bannerId,
          step: "content",
          input: {
            name: form.name,
            slug: form.slug || slugify(form.name),
            shortDescription: form.shortDescription,
            longDescription: form.longDescription || undefined,
            ctaLabel: cta.href ? form.ctaLabel || undefined : undefined,
            ctaHref: cta.href,
            ctaKind: cta.kind,
          },
        });
      } else if (step === "design") {
        await advanceMut.mutateAsync({
          id: bannerId,
          step: "design",
          input: {
            backgroundCss: form.backgroundCss,
            mainImageUrl: form.mainImageUrl ?? "",
          },
        });
      } else if (step === "schedule") {
        await advanceMut.mutateAsync({
          id: bannerId,
          step: "schedule",
          input: {
            displayFrom: form.displayFrom ?? undefined,
            displayUntil: form.displayUntil ?? undefined,
          },
        });
      }
      return true;
    } catch {
      toast.error(t("saveError"));
      return false;
    }
  }

  /** Jump to any reachable step (stepper click / Back). Persists the current
   *  step first (each step saves on leave) unless it's invalid — then it just
   *  navigates without saving, so you can move off a half-filled step. */
  async function goTo(targetIndex: number) {
    if (targetIndex === stepIndex) return;
    setAttempted(false);
    if (valid[step] && !(await persistStep())) return;
    setStepIndex(targetIndex);
  }

  async function onNext() {
    if (step !== "review" && !valid[step]) {
      setAttempted(true);
      return;
    }
    if (step === "review") {
      if (!bannerId) return;
      try {
        await publishMut.mutateAsync({ id: bannerId });
        bypass.current = true;
        setDirty(false);
        await queryClient.invalidateQueries(trpc.banners.adminList.queryFilter());
        await queryClient.invalidateQueries(trpc.banners.list.queryFilter());
        toast.success(id ? t("updated", { name: form.name }) : t("created", { name: form.name }));
        router.push("/banners");
      } catch {
        toast.error(t("publishError"));
      }
      return;
    }
    const ok = await persistStep();
    if (ok) {
      setAttempted(false);
      setStepIndex((n) => n + 1);
    }
  }

  const busy = createMut.isPending && !bannerId;
  const saving = advanceMut.isPending || publishMut.isPending;

  return (
    <>
    <WizardShell
      title={id ? t("editTitle") : t("newTitle")}
      steps={steps}
      current={step}
      completed={completed}
      navigable={navigable}
      onStepSelect={(key) => {
        if (!saving) void goTo(STEPS.indexOf(key as Step));
      }}
      onBack={() => goTo(Math.max(0, stepIndex - 1))}
      onNext={onNext}
      isFirst={stepIndex === 0}
      isLast={step === "review"}
      finishLabel={id ? t("saveChanges") : t("publish")}
      saving={saving}
      onExit={tryExit}
      exitLabel={t("title")}
      preview={<BannerPreview form={form} />}
    >
      {busy ? (
        <p className="text-muted-foreground text-sm">…</p>
      ) : step === "content" ? (
        <div className="space-y-4">
          <Field label={t("fieldTitle")}>
            <Input
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (slugAuto) set("slug", slugify(e.target.value));
              }}
              placeholder={t("fieldTitlePlaceholder")}
              className="h-10"
              aria-invalid={attempted && !form.name.trim() ? true : undefined}
              autoFocus
            />
            {attempted && !form.name.trim() ? <ErrorText>{t("saveError")}</ErrorText> : null}
          </Field>
          <SlugField
            slug={form.slug}
            auto={slugAuto}
            excludeId={bannerId}
            invalid={attempted && !form.slug.trim()}
            onAutoChange={(on) => {
              setSlugAuto(on);
              if (on) set("slug", slugify(form.name));
            }}
            onChange={(v) => set("slug", slugify(v))}
          />
          <Field label={t("fieldSubtitle")}>
            <Input
              value={form.shortDescription}
              onChange={(e) => set("shortDescription", e.target.value)}
              placeholder={t("fieldSubtitlePlaceholder")}
              className="h-10"
              aria-invalid={attempted && !form.shortDescription.trim() ? true : undefined}
            />
            {attempted && !form.shortDescription.trim() ? (
              <ErrorText>{t("saveError")}</ErrorText>
            ) : null}
          </Field>
          <Field label={t("fieldLong")} hint={t("optional")}>
            <RichTextEditor
              value={form.longDescription}
              onValueChange={(html) => set("longDescription", html)}
            />
          </Field>
          <Field label={t("fieldCtaTarget")} hint={t("optional")}>
            <Select
              value={form.ctaTarget}
              onValueChange={(v) => {
                set("ctaTarget", (v as CtaTarget) ?? "none");
                set("ctaValue", "");
              }}
            >
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>{(v) => t(`ctaTarget.${v as string}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("ctaTarget.none")}</SelectItem>
                <SelectItem value="external">{t("ctaTarget.external")}</SelectItem>
                <SelectItem value="product">{t("ctaTarget.product")}</SelectItem>
                <SelectItem value="promo">{t("ctaTarget.promo")}</SelectItem>
                <SelectItem value="reward">{t("ctaTarget.reward")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.ctaTarget !== "none" ? (
            <div className="space-y-4">
              <Field label={t("fieldCta")}>
                <Input
                  value={form.ctaLabel}
                  onChange={(e) => set("ctaLabel", e.target.value)}
                  placeholder={t("fieldCtaPlaceholder")}
                  className="h-10"
                />
              </Field>
              {form.ctaTarget === "external" ? (
                <Field label={t("ctaValueUrl")}>
                  <Input
                    value={form.ctaValue}
                    onChange={(e) => set("ctaValue", e.target.value)}
                    placeholder="https://…"
                    className="h-10"
                  />
                </Field>
              ) : form.ctaTarget === "product" ? (
                <Field label={t("ctaValueProduct")}>
                  <CtaEntityPicker
                    kind="product"
                    value={form.ctaValue}
                    onChange={(slug) => set("ctaValue", slug)}
                    placeholder={t("ctaPickProduct")}
                    emptyLabel={t("empty")}
                  />
                  {attempted && !form.ctaValue.trim() ? (
                    <ErrorText>{t("ctaProductRequired")}</ErrorText>
                  ) : null}
                </Field>
              ) : form.ctaTarget === "promo" ? (
                <Field label={t("ctaValuePromo")} hint={t("optional")}>
                  <CtaEntityPicker
                    kind="promo"
                    value={form.ctaValue}
                    onChange={(slug) => set("ctaValue", slug)}
                    placeholder={t("ctaPickPromo")}
                    emptyLabel={t("empty")}
                  />
                </Field>
              ) : (
                <p className="text-muted-foreground text-sm">{t("ctaRewardHint")}</p>
              )}
            </div>
          ) : null}
        </div>
      ) : step === "design" ? (
        <div className="space-y-4">
          <Field label={t("fieldGradient")}>
            <BackgroundPicker
              value={form.backgroundCss}
              onValueChange={(bg) => set("backgroundCss", bg)}
              onUploadImage={uploadImage}
              uploadLabel={t("imgUpload")}
              removeLabel={t("imgRemove")}
            />
          </Field>
          <Field label={t("fieldMainImage")} hint={t("optional")}>
            <FileUpload
              value={form.mainImageUrl ? [form.mainImageUrl] : []}
              onChange={(urls) => set("mainImageUrl", urls[urls.length - 1] ?? null)}
              accept={{ "image/*": [] }}
              multiple={false}
            />
          </Field>
        </div>
      ) : step === "schedule" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("fieldStart")} hint={t("optional")}>
              <DatePicker
                value={form.displayFrom ?? undefined}
                onValueChange={(d) => set("displayFrom", d ?? null)}
                placeholder={t("datePlaceholder")}
                formatLabel={(d) => formatDate(d, { locale })}
              />
            </Field>
            <Field label={t("fieldEnd")} hint={t("optional")}>
              <DatePicker
                value={form.displayUntil ?? undefined}
                onValueChange={(d) => set("displayUntil", d ?? null)}
                placeholder={t("datePlaceholder")}
                formatLabel={(d) => formatDate(d, { locale })}
              />
            </Field>
          </div>
          {bannerId ? <NotificationsPanel bannerId={bannerId} /> : null}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("reviewTitle")}
          </h2>
          <dl className="divide-border divide-y text-sm">
            <ReviewRow label={t("fieldTitle")} value={form.name || "—"} />
            <ReviewRow label={t("fieldSlug")} value={form.slug || "—"} />
            <ReviewRow label={t("fieldSubtitle")} value={form.shortDescription || "—"} />
            <ReviewRow
              label={t("fieldCta")}
              value={
                form.ctaTarget === "none"
                  ? "—"
                  : `${form.ctaLabel || "—"} → ${t(`ctaTarget.${form.ctaTarget}`)}`
              }
            />
            <ReviewRow
              label={t("fieldStart")}
              value={form.displayFrom ? formatDate(form.displayFrom, { locale }) : "—"}
            />
            <ReviewRow
              label={t("fieldEnd")}
              value={form.displayUntil ? formatDate(form.displayUntil, { locale }) : "—"}
            />
          </dl>
        </div>
      )}
    </WizardShell>

    <ResponsiveModal open={exitOpen} onOpenChange={setExitOpen}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{t("unsavedTitle")}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <p className="text-muted-foreground px-4 pb-2 text-sm">{t("unsavedHint")}</p>
        <ResponsiveModalFooter className="gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full px-5"
            onClick={() => setExitOpen(false)}
          >
            {t("stay")}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-full px-6 font-semibold"
            onClick={confirmLeave}
          >
            {t("leave")}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
    </>
  );
}

/** Scheduled-notifications manager for a banner. */
function NotificationsPanel({ bannerId }: { bannerId: string }) {
  const t = useTranslations("Banners");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const list = useQuery(trpc.banners.notifications.list.queryOptions({ bannerId }));
  const invalidate = () =>
    queryClient.invalidateQueries(trpc.banners.notifications.list.queryFilter({ bannerId }));

  const create = useMutation(
    trpc.banners.notifications.create.mutationOptions({ onSuccess: () => invalidate() }),
  );
  const cancel = useMutation(
    trpc.banners.notifications.cancel.mutationOptions({ onSuccess: () => invalidate() }),
  );

  const [audienceType, setAudienceType] = useState<"all" | "tier" | "specific">("all");
  const [tierKey, setTierKey] = useState<(typeof TIERS)[number]>("oro");
  const [channels, setChannels] = useState<string[]>(["push", "database", "realtime"]);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // Live reach = audience for the current selection minus marketing opt-outs.
  const reach = useQuery({
    ...trpc.banners.countByAudience.queryOptions({
      audienceType,
      ...(audienceType === "tier" ? { tierKey } : {}),
      ...(audienceType === "specific" ? { customerIds: selected } : {}),
    }),
    enabled: audienceType !== "specific" || selected.length > 0,
  });

  const toggleChannel = (c: string) =>
    setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  // Schedule = one Date holding day + time. Picking a day keeps the chosen time
  // (defaults to 09:00); clearing it → null = "send now".
  const timeStr = scheduledAt
    ? `${String(scheduledAt.getHours()).padStart(2, "0")}:${String(scheduledAt.getMinutes()).padStart(2, "0")}`
    : "09:00";
  const setDate = (d: Date | undefined) => {
    if (!d) return setScheduledAt(null);
    const next = new Date(d);
    next.setHours(scheduledAt?.getHours() ?? 9, scheduledAt?.getMinutes() ?? 0, 0, 0);
    setScheduledAt(next);
  };
  const setTime = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    const base = scheduledAt ? new Date(scheduledAt) : new Date();
    base.setHours(h ?? 0, m ?? 0, 0, 0);
    setScheduledAt(base);
  };

  const onAdd = () => {
    if (channels.length === 0) {
      toast.error(t("notify.needChannel"));
      return;
    }
    create.mutate(
      {
        bannerId,
        audienceType,
        tierKey: audienceType === "tier" ? tierKey : undefined,
        customerIds: audienceType === "specific" ? selected : undefined,
        channels: channels as ("push" | "database" | "realtime")[],
        scheduledAt: scheduledAt ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("notify.added"));
          setSelected([]);
        },
        onError: () => toast.error(t("notify.addError")),
      },
    );
  };

  return (
    <div className="border-border space-y-4 rounded-2xl border p-4">
      <div className="flex items-center gap-2">
        <Bell className="text-muted-foreground size-4" />
        <h3 className="text-sm font-bold">{t("notify.title")}</h3>
      </div>

      {/* Existing notifications */}
      {(list.data ?? []).length > 0 ? (
        <ul className="space-y-2">
          {list.data!.map((n) => (
            <li
              key={n.id}
              className="bg-muted/40 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {n.audienceType === "all"
                    ? t("notify.audAll")
                    : n.audienceType === "tier"
                      ? `${t("notify.audTier")} · ${n.tierKey}`
                      : `${t("notify.audSpecific")} · ${n.customerCount ?? 0}`}
                </p>
                <p className="text-muted-foreground text-xs">
                  {n.channels.join(", ")} ·{" "}
                  {n.scheduledAt ? formatDate(n.scheduledAt, { locale }) : t("notify.now")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t(`notify.status.${n.status}`)}</Badge>
                {n.status === "scheduled" ? (
                  <Button
                    variant="ghost"
                    className="size-7 rounded-lg p-0"
                    aria-label={t("notify.cancel")}
                    onClick={() => cancel.mutate({ id: n.id })}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">{t("notify.empty")}</p>
      )}

      {/* Add form */}
      <div className="space-y-3 border-t border-dashed pt-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("notify.audience")}>
            <Select
              value={audienceType}
              onValueChange={(v) => setAudienceType((v as typeof audienceType) ?? "all")}
            >
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>{(v) => t(`notify.aud${capitalize(v as string)}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("notify.audAll")}</SelectItem>
                <SelectItem value="tier">{t("notify.audTier")}</SelectItem>
                <SelectItem value="specific">{t("notify.audSpecific")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {audienceType === "tier" ? (
            <Field label={t("notify.tier")}>
              <Select value={tierKey} onValueChange={(v) => setTierKey((v as typeof tierKey) ?? "oro")}>
                <SelectTrigger size="lg" className="w-full text-sm">
                  <SelectValue>{(v) => v as string}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field label={t("notify.when")} hint={scheduledAt ? undefined : t("notify.now")}>
            <div className="flex items-center gap-2">
              <DatePicker
                value={scheduledAt ?? undefined}
                onValueChange={setDate}
                placeholder={t("notify.now")}
                formatLabel={(d) => formatDate(d, { locale })}
                className="flex-1"
              />
              {scheduledAt ? (
                <>
                  <TimeInput value={timeStr} onChange={setTime} className="h-10 w-24" />
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-9 shrink-0 rounded-lg p-0"
                    aria-label={t("notify.now")}
                    onClick={() => setScheduledAt(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : null}
            </div>
          </Field>
        </div>

        {audienceType === "specific" ? (
          <Field label={t("notify.audSpecific")}>
            <CustomerCombobox
              value={selected}
              onChange={setSelected}
              placeholder={t("notify.searchCustomers")}
              emptyLabel={t("empty")}
            />
          </Field>
        ) : null}

        {/* Reach preview — how many would actually receive it (minus opt-outs). */}
        <div className="bg-muted/40 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
          <Users className="text-muted-foreground size-4 shrink-0" />
          {reach.data ? (
            <p>
              <span className="font-semibold">{reach.data.eligible}</span>
              <span className="text-muted-foreground"> / {reach.data.audience} · {t("reachEligible")}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              {audienceType === "specific" && selected.length === 0
                ? t("notify.searchCustomers")
                : "…"}
            </p>
          )}
        </div>

        <Field label={t("notify.channels")}>
          <div className="flex flex-wrap gap-3">
            {CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm font-semibold">
                <Checkbox checked={channels.includes(c)} onCheckedChange={() => toggleChannel(c)} />
                {t(`notify.ch.${c}`)}
              </label>
            ))}
          </div>
        </Field>

        <Button
          className="h-10 rounded-xl"
          onClick={onAdd}
          disabled={create.isPending}
        >
          {scheduledAt ? t("notify.schedule") : t("notify.sendNow")}
        </Button>
      </div>
    </div>
  );
}

function BannerPreview({ form }: { form: Form }) {
  return (
    <div
      className="preview-customer relative h-44 overflow-hidden rounded-3xl shadow-sm"
      style={{ background: form.backgroundCss }}
    >
      {/* Foreground main image — mirrors the customer card (right-anchored). */}
      {form.mainImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={form.mainImageUrl}
          alt=""
          className="absolute inset-y-3 right-3 z-10 w-2/5 object-contain object-right"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
      <div className="relative z-10 flex h-full max-w-[62%] flex-col justify-center p-5 text-white">
        <p className="font-display text-xl leading-tight font-semibold">
          {form.name || "—"}
        </p>
        {form.shortDescription ? (
          <p className="mt-1 line-clamp-2 text-sm text-white/85">{form.shortDescription}</p>
        ) : null}
        {form.ctaTarget !== "none" && form.ctaLabel ? (
          <span className="mt-3 inline-flex w-fit rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-bold text-black">
            {form.ctaLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
        {hint ? (
          <span className="text-muted-foreground/70 text-xs font-semibold">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-destructive text-xs font-semibold">{children}</p>;
}

/** Slug input with an auto-generate toggle + a debounced live availability check. */
function SlugField({
  slug,
  auto,
  excludeId,
  invalid,
  onAutoChange,
  onChange,
}: {
  slug: string;
  auto: boolean;
  excludeId?: string;
  invalid: boolean;
  onAutoChange: (on: boolean) => void;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("Banners");
  const trpc = useTRPC();
  const debounced = useDebounce(slug, { wait: 350 });
  const check = useQuery({
    ...trpc.banners.slugAvailable.queryOptions({
      slug: debounced,
      ...(excludeId ? { excludeId } : {}),
    }),
    enabled: debounced.trim().length > 0,
  });
  const available = check.data;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{t("fieldSlug")}</Label>
        <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs font-semibold">
          {t("slugAuto")}
          <Switch checked={auto} onCheckedChange={onAutoChange} />
        </label>
      </div>
      <div className="relative">
        <Input
          value={slug}
          onChange={(e) => onChange(e.target.value)}
          placeholder="spring-drop"
          className="h-10 font-mono"
          readOnly={auto}
          disabled={auto}
          aria-invalid={invalid || available === false ? true : undefined}
        />
        {!auto && available === true ? (
          <Check className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-emerald-500" />
        ) : null}
      </div>
      {available === false ? (
        <ErrorText>{t("slugTaken")}</ErrorText>
      ) : !auto && available === true ? (
        <p className="text-xs font-semibold text-emerald-600">{t("slugAvailable")}</p>
      ) : null}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground font-semibold">{label}</dt>
      <dd className="truncate text-right font-bold">{value}</dd>
    </div>
  );
}
