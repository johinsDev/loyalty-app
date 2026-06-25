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
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { FileUpload } from "@/features/storage/components/file-upload";
import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

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

/** Reverse a stored ctaHref into the editor's target + value. */
function parseCta(href: string | null): { ctaTarget: CtaTarget; ctaValue: string } {
  if (!href) return { ctaTarget: "none", ctaValue: "" };
  if (/^https?:\/\//i.test(href)) return { ctaTarget: "external", ctaValue: href };
  if (href.startsWith("/product/"))
    return { ctaTarget: "product", ctaValue: href.slice("/product/".length) };
  if (href === "/promos") return { ctaTarget: "promo", ctaValue: "" };
  if (href === "/rewards") return { ctaTarget: "reward", ctaValue: "" };
  return { ctaTarget: "external", ctaValue: href };
}

/** Build the stored ctaHref + kind from the editor's target + value. */
function buildCta(target: CtaTarget, value: string): { href?: string; kind?: "internal" | "external" } {
  if (target === "none") return {};
  if (target === "external") return { href: value, kind: "external" };
  if (target === "product") return { href: `/product/${slugify(value)}`, kind: "internal" };
  if (target === "promo") return { href: "/promos", kind: "internal" };
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

  const [bannerId, setBannerId] = useState<string | undefined>(id);
  const [form, setForm] = useState<Form>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [stepIndex, setStepIndex] = useState(0);
  const seeded = useRef(false);
  const creating = useRef(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

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
  const completed = STEPS.slice(0, stepIndex);

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

  async function onNext() {
    if (step === "review") {
      if (!bannerId) return;
      try {
        await publishMut.mutateAsync({ id: bannerId });
        await queryClient.invalidateQueries(trpc.banners.list.queryFilter());
        toast.success(id ? t("updated", { name: form.name }) : t("created", { name: form.name }));
        router.push("/banners");
      } catch {
        toast.error(t("publishError"));
      }
      return;
    }
    const ok = await persistStep();
    if (ok) setStepIndex((n) => n + 1);
  }

  const busy = createMut.isPending && !bannerId;

  return (
    <WizardShell
      title={id ? t("editTitle") : t("newTitle")}
      steps={steps}
      current={step}
      completed={completed}
      onStepSelect={(key) => {
        const idx = STEPS.indexOf(key as Step);
        if (idx <= stepIndex) setStepIndex(idx);
      }}
      onBack={() => setStepIndex((n) => Math.max(0, n - 1))}
      onNext={onNext}
      isFirst={stepIndex === 0}
      isLast={step === "review"}
      finishLabel={id ? t("saveChanges") : t("publish")}
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
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              placeholder={t("fieldTitlePlaceholder")}
              className="h-10"
              autoFocus
            />
          </Field>
          <Field label={t("fieldSlug")}>
            <Input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
              placeholder="spring-drop"
              className="h-10"
            />
          </Field>
          <Field label={t("fieldSubtitle")}>
            <Input
              value={form.shortDescription}
              onChange={(e) => set("shortDescription", e.target.value)}
              placeholder={t("fieldSubtitlePlaceholder")}
              className="h-10"
            />
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
              onValueChange={(v) => set("ctaTarget", (v as CtaTarget) ?? "none")}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("fieldCta")}>
                <Input
                  value={form.ctaLabel}
                  onChange={(e) => set("ctaLabel", e.target.value)}
                  placeholder={t("fieldCtaPlaceholder")}
                  className="h-10"
                />
              </Field>
              {form.ctaTarget === "external" || form.ctaTarget === "product" ? (
                <Field
                  label={
                    form.ctaTarget === "external" ? t("ctaValueUrl") : t("ctaValueProduct")
                  }
                >
                  <Input
                    value={form.ctaValue}
                    onChange={(e) => set("ctaValue", e.target.value)}
                    placeholder={form.ctaTarget === "external" ? "https://…" : "spring-drop"}
                    className="h-10"
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : step === "design" ? (
        <div className="space-y-4">
          <Field label={t("fieldGradient")}>
            <BackgroundPicker
              value={form.backgroundCss}
              onValueChange={(bg) => set("backgroundCss", bg)}
            />
          </Field>
          <Field label={t("fieldMainImage")} hint={t("optional")}>
            <FileUpload
              value={form.mainImageUrl ? [form.mainImageUrl] : []}
              onChange={(urls) => set("mainImageUrl", urls[urls.length - 1] ?? null)}
              accept={{ "image/*": [] }}
              multiple={false}
              disk="public"
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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const customers = useQuery({
    ...trpc.customers.search.queryOptions({ query, limit: 10 }),
    enabled: audienceType === "specific",
  });

  const toggleChannel = (c: string) =>
    setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const toggleCustomer = (cid: string) =>
    setSelected((cur) => (cur.includes(cid) ? cur.filter((x) => x !== cid) : [...cur, cid]));

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
          <Field label={t("notify.when")} hint={t("notify.now")}>
            <DatePicker
              value={scheduledAt ?? undefined}
              onValueChange={(d) => setScheduledAt(d ?? null)}
              placeholder={t("notify.now")}
              formatLabel={(d) => formatDate(d, { locale })}
            />
          </Field>
        </div>

        {audienceType === "specific" ? (
          <Field label={t("notify.audSpecific")}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("notify.searchCustomers")}
              className="h-10"
            />
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {(customers.data ?? []).map((c) => (
                <label
                  key={c.id}
                  className="hover:bg-muted/50 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={selected.includes(c.id)}
                    onCheckedChange={() => toggleCustomer(c.id)}
                  />
                  <span className="truncate">{c.name ?? c.phone}</span>
                </label>
              ))}
            </div>
          </Field>
        ) : null}

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
      className="relative h-44 overflow-hidden rounded-3xl shadow-sm"
      style={{ background: form.backgroundCss }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
      <div className="relative z-10 flex h-full max-w-[70%] flex-col justify-center p-5 text-white">
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground font-semibold">{label}</dt>
      <dd className="truncate text-right font-bold">{value}</dd>
    </div>
  );
}
