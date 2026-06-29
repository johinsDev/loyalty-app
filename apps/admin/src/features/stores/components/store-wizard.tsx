"use client";

import {
  AddressField,
  Button,
  createGooglePlacesProvider,
  Input,
  InputPhone,
  Label,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type StoreAddress,
  StoreAddressPreview,
  Switch,
  TimeInput,
  UrlInput,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAddressLabels } from "@/components/use-address-labels";
import { WizardShell } from "@/components/wizard-shell";
import { FileUpload } from "@/features/storage/components/file-upload";
import { env } from "@/env";
import { useRouter } from "@/i18n/navigation";
import { useNavigationGuard } from "@/lib/use-unsaved-guard";
import { useTRPC } from "@/lib/trpc/client";

const STEPS = ["datos", "horarios", "marca", "review"] as const;
type Step = (typeof STEPS)[number];

const SOCIALS = ["instagram", "whatsapp", "facebook", "tiktok", "x", "website"] as const;
type SocialLinks = Partial<Record<(typeof SOCIALS)[number], string>>;
type DayHours = { open: string; close: string; closed: boolean };
type Hours = Record<string, DayHours>;
/** Display order Mon→Sun; storage keys are "0" (Sun)…"6" (Sat). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Curated IANA timezones (LatAm-first); covers the pilot + nearby SaaS markets. */
const TIMEZONES = [
  "America/Bogota",
  "America/Lima",
  "America/Mexico_City",
  "America/Guayaquil",
  "America/Caracas",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "America/Panama",
  "America/Costa_Rica",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/Madrid",
] as const;

function defaultHours(): Hours {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, d) => [String(d), { open: "10:00", close: "21:00", closed: false }]),
  );
}

const URL_SOCIALS = ["instagram", "facebook", "tiktok", "x", "website"] as const;

/** A real http(s) URL with a dotted hostname (rejects "foo", "https://foo"). */
function isValidHttpUrl(u: string): boolean {
  if (!u) return true;
  try {
    const url = new URL(u);
    return (url.protocol === "http:" || url.protocol === "https:") && /\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
}
/** Day keys with close ≤ open (invalid) among the open days. */
function badHourDays(hours: Hours): string[] {
  return Object.keys(hours).filter((k) => {
    const d = hours[k]!;
    return !d.closed && d.close <= d.open;
  });
}
function invalidSocialKeys(s: SocialLinks): string[] {
  return URL_SOCIALS.filter((k) => !isValidHttpUrl(s[k] ?? ""));
}

type Form = {
  name: string;
  address: StoreAddress | null;
  timezone: string;
  hours: Hours;
  inheritHours: boolean;
  logo: string | null;
  inheritLogo: boolean;
  socialLinks: SocialLinks;
  inheritSocial: boolean;
  phone: string;
  inheritPhone: boolean;
  isPrimary: boolean;
  isPublished: boolean;
};

const EMPTY: Form = {
  name: "",
  address: null,
  timezone: "America/Bogota",
  hours: defaultHours(),
  inheritHours: false,
  logo: null,
  inheritLogo: true,
  socialLinks: {},
  inheritSocial: true,
  phone: "",
  inheritPhone: true,
  isPrimary: false,
  isPublished: true,
};

/**
 * Store create/edit wizard (Datos → Horarios → Marca → Revisar). On "new" it
 * creates a draft once; each step persists its slice via `stores.update`;
 * Finish `publish`es. Branding/contact/schedule fields can inherit the org's
 * defaults (toggle → the field is saved as `null`). Mirrors the PromoWizard.
 */
export function StoreWizard({ id }: { id?: string }) {
  const t = useTranslations("Stores");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const addressLabels = useAddressLabels();

  const provider = useMemo(() => {
    const key = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    return key ? createGooglePlacesProvider({ apiKey: key }) : undefined;
  }, []);

  const [storeId, setStoreId] = useState<string | undefined>(id);
  const [form, setForm] = useState<Form>(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
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
    // A real link destination → go there; Back-button / exit → the list.
    if (pendingHref && pendingHref !== "__back__") window.location.href = pendingHref;
    else router.push("/stores");
  };

  // Org defaults (shown as the inherited value).
  const org = useQuery(trpc.settings.branding.queryOptions());
  const orgHours = (org.data?.defaultHours ?? null) as Hours | null;

  // New store → create a draft once.
  const createMut = useMutation(trpc.stores.create.mutationOptions());
  useEffect(() => {
    if (id || storeId || creating.current) return;
    creating.current = true;
    createMut.mutate(undefined, { onSuccess: (res) => setStoreId(res.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, storeId]);

  // Edit → load + seed once.
  const getQuery = useQuery({
    ...trpc.stores.get.queryOptions({ id: id ?? "" }),
    enabled: Boolean(id),
  });
  useEffect(() => {
    if (!id || !getQuery.data || seeded.current) return;
    const s = getQuery.data;
    const address: StoreAddress | null =
      s.addressParts ??
      (s.address
        ? {
            line1: s.address,
            ...(s.lat != null ? { lat: s.lat } : {}),
            ...(s.lng != null ? { lng: s.lng } : {}),
            ...(s.placeId ? { placeId: s.placeId } : {}),
            formatted: s.address,
          }
        : null);
    setForm({
      name: s.name,
      address,
      timezone: s.timezone,
      hours: (s.hours as Hours | null) ?? defaultHours(),
      inheritHours: s.hours == null,
      logo: s.logo,
      inheritLogo: s.logo == null,
      socialLinks: (s.socialLinks as SocialLinks | null) ?? {},
      inheritSocial: s.socialLinks == null,
      phone: s.phone ?? "",
      inheritPhone: s.phone == null,
      isPrimary: s.isPrimary,
      isPublished: s.isPublished,
    });
    seeded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, getQuery.data]);

  const updateMut = useMutation(trpc.stores.update.mutationOptions());
  const publishMut = useMutation(trpc.stores.publish.mutationOptions());

  const step = STEPS[stepIndex]!;
  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));

  // Per-step validity → which steps you may jump to (req: click forward to a
  // step whose prerequisites are all valid).
  const badDays = form.inheritHours ? [] : badHourDays(form.hours);
  const badSocials = form.inheritSocial ? [] : invalidSocialKeys(form.socialLinks);
  const datosOk = form.name.trim().length > 0 && Boolean(form.address?.line1);
  const valid: Record<Step, boolean> = {
    datos: datosOk,
    horarios: badDays.length === 0,
    marca: badSocials.length === 0,
    review: datosOk,
  };
  const navigable: string[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    const priorOk = STEPS.slice(0, i).every((s) => valid[s]);
    if (priorOk) navigable.push(STEPS[i]!);
  }
  const completed = STEPS.slice(0, stepIndex).filter((s) => valid[s]);

  async function persistStep(which: Step): Promise<boolean> {
    if (!storeId) return false;
    try {
      if (which === "datos") {
        await updateMut.mutateAsync({ id: storeId, name: form.name || undefined, address: form.address });
      } else if (which === "horarios") {
        await updateMut.mutateAsync({
          id: storeId,
          hours: form.inheritHours ? null : form.hours,
          timezone: form.timezone,
        });
      } else if (which === "marca") {
        await updateMut.mutateAsync({
          id: storeId,
          logo: form.inheritLogo ? null : (form.logo ?? ""),
          socialLinks: form.inheritSocial ? null : form.socialLinks,
          phone: form.inheritPhone ? null : form.phone || "",
        });
      } else if (which === "review") {
        await updateMut.mutateAsync({
          id: storeId,
          isPrimary: form.isPrimary,
          isPublished: form.isPublished,
        });
      }
      setDirty(false);
      return true;
    } catch {
      toast.error(t("saveError"));
      return false;
    }
  }

  async function goTo(targetIndex: number) {
    if (targetIndex === stepIndex) return;
    setAttempted(false);
    // Don't persist an invalid step (e.g. going back) — just navigate.
    if (valid[step] && !(await persistStep(step))) return;
    setStepIndex(targetIndex);
  }

  async function onNext() {
    setAttempted(true);
    if (!valid[step]) {
      toast.error(t("fixErrors"));
      return;
    }
    if (step === "review") {
      if (!storeId) return;
      if (!(await persistStep("review"))) return;
      try {
        await publishMut.mutateAsync({ id: storeId });
        bypass.current = true;
        setDirty(false);
        await queryClient.invalidateQueries(trpc.stores.list.queryFilter());
        toast.success(id ? t("updated", { name: form.name }) : t("created", { name: form.name }));
        router.push("/stores");
      } catch {
        toast.error(t("publishError"));
      }
      return;
    }
    if (await persistStep(step)) {
      setAttempted(false);
      setStepIndex((n) => n + 1);
    }
  }

  const tryExit = () => {
    if (dirty) {
      setPendingHref(null);
      setExitOpen(true);
    } else {
      router.push("/stores");
    }
  };
  const busy = createMut.isPending && !storeId;
  const saving = updateMut.isPending || publishMut.isPending;

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
        maxWidthClassName="max-w-7xl"
        onExit={tryExit}
        exitLabel={t("title")}
        preview={<StorePreview form={form} orgHours={orgHours} />}
      >
        {busy ? (
          <p className="text-muted-foreground text-sm">…</p>
        ) : step === "datos" ? (
          <div className="space-y-4">
            <Field label={t("fieldName")}>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("namePlaceholder")}
                className="h-10"
                aria-invalid={attempted && !form.name.trim() ? true : undefined}
                autoFocus
              />
              {attempted && !form.name.trim() ? <ErrorText>{t("errorName")}</ErrorText> : null}
            </Field>
            <Field label={t("fieldAddress")}>
              <AddressField
                value={form.address}
                onChange={(a) => set("address", a)}
                {...(provider ? { provider } : {})}
                {...(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                  ? { mapsApiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY }
                  : {})}
                labels={addressLabels}
              />
              {attempted && !form.address?.line1 ? <ErrorText>{t("errorAddress")}</ErrorText> : null}
            </Field>
          </div>
        ) : step === "horarios" ? (
          <div className="space-y-4">
            <InheritToggle
              label={t("inheritHours")}
              checked={form.inheritHours}
              onChange={(v) => set("inheritHours", v)}
            />
            {form.inheritHours ? (
              <p className="text-muted-foreground text-sm">{t("inheritHoursHint")}</p>
            ) : (
              <div className="space-y-2">
                {DAY_ORDER.map((d) => {
                  const key = String(d);
                  const dh = form.hours[key] ?? { open: "10:00", close: "21:00", closed: false };
                  return (
                    <div key={key} className="border-border space-y-2 rounded-2xl border p-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={!dh.closed}
                          onCheckedChange={(open) =>
                            set("hours", { ...form.hours, [key]: { ...dh, closed: !open } })
                          }
                        />
                        <span className="flex-1 text-sm font-semibold">
                          {t(`day.${DAY_KEY[d]}`)}
                        </span>
                        {dh.closed ? (
                          <span className="text-muted-foreground text-sm font-semibold">
                            {t("closed")}
                          </span>
                        ) : null}
                      </div>
                      {!dh.closed ? (
                        <div className="flex items-center gap-2">
                          <TimeInput
                            className="min-w-0 flex-1"
                            value={dh.open}
                            onChange={(open) =>
                              set("hours", { ...form.hours, [key]: { ...dh, open } })
                            }
                          />
                          <span className="text-muted-foreground shrink-0 text-sm">–</span>
                          <TimeInput
                            className="min-w-0 flex-1"
                            value={dh.close}
                            onChange={(close) =>
                              set("hours", { ...form.hours, [key]: { ...dh, close } })
                            }
                          />
                        </div>
                      ) : null}
                      {!dh.closed && dh.close <= dh.open ? (
                        <span className="text-destructive text-xs font-medium">
                          {t("errorHours")}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            <Field label={t("fieldTimezone")}>
              <Select value={form.timezone} onValueChange={(v) => set("timezone", v ?? form.timezone)}>
                <SelectTrigger size="lg" className="h-10 w-full text-sm">
                  <SelectValue>{(v) => (v as string) || form.timezone}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : step === "marca" ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <InheritToggle
                label={t("inheritLogo")}
                checked={form.inheritLogo}
                onChange={(v) => set("inheritLogo", v)}
              />
              {form.inheritLogo ? null : (
                <FileUpload
                  value={form.logo ? [form.logo] : []}
                  onChange={(urls) => set("logo", urls[urls.length - 1] ?? null)}
                  accept={{ "image/*": [] }}
                  multiple={false}
                  disk="public"
                />
              )}
            </div>

            <div className="space-y-2">
              <InheritToggle
                label={t("inheritSocial")}
                checked={form.inheritSocial}
                onChange={(v) => set("inheritSocial", v)}
              />
              {form.inheritSocial ? null : (
                <div className="space-y-2">
                  {SOCIALS.map((s) =>
                    s === "whatsapp" ? (
                      <InputPhone
                        key={s}
                        size="sm"
                        value={form.socialLinks[s] ?? ""}
                        onChange={(v) =>
                          set("socialLinks", { ...form.socialLinks, [s]: v.e164 })
                        }
                      />
                    ) : (
                      <div key={s} className="space-y-1">
                        <UrlInput
                          value={form.socialLinks[s] ?? ""}
                          onChange={(v) => set("socialLinks", { ...form.socialLinks, [s]: v })}
                          placeholder={`… (${s})`}
                        />
                        {!isValidHttpUrl(form.socialLinks[s] ?? "") ? (
                          <ErrorText>{t("errorUrl")}</ErrorText>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <InheritToggle
                label={t("inheritPhone")}
                checked={form.inheritPhone}
                onChange={(v) => set("inheritPhone", v)}
              />
              {form.inheritPhone ? null : (
                <InputPhone
                  size="sm"
                  value={form.phone}
                  onChange={(v) => set("phone", v.e164)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold tracking-tight">{t("reviewTitle")}</h2>
            <dl className="divide-border divide-y text-sm">
              <ReviewRow label={t("fieldName")} value={form.name || "—"} />
              <ReviewRow label={t("fieldAddress")} value={form.address?.formatted || "—"} />
              <ReviewRow label={t("inheritHours")} value={form.inheritHours ? t("yes") : t("no")} />
            </dl>
            <ToggleRow
              label={t("fieldPrimary")}
              hint={t("primaryHint")}
              checked={form.isPrimary}
              onChange={(v) => set("isPrimary", v)}
            />
            <ToggleRow
              label={t("fieldPublished")}
              hint={t("publishedHint")}
              checked={form.isPublished}
              onChange={(v) => set("isPublished", v)}
            />
          </div>
        )}
      </WizardShell>

      <ResponsiveModal open={exitOpen} onOpenChange={setExitOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("leaveTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">{t("leaveDescription")}</p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setExitOpen(false)}
            >
              {t("leaveStay")}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full px-6 font-semibold"
              onClick={confirmLeave}
            >
              {t("leaveConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

function StorePreview({ form, orgHours }: { form: Form; orgHours: Record<string, DayHours> | null }) {
  const t = useTranslations("Stores");
  const hours = form.inheritHours ? orgHours : form.hours;
  const openDays = hours
    ? DAY_ORDER.filter((d) => hours[String(d)] && !hours[String(d)]!.closed).length
    : 0;
  return (
    <div className="space-y-3">
      <StoreAddressPreview
        address={form.address}
        name={form.name || t("namePlaceholder")}
        labels={{ title: t("previewTitle"), empty: t("previewEmpty") }}
      />
      {hours ? (
        <p className="text-muted-foreground text-xs font-semibold">
          {t("previewOpenDays", { n: openDays })}
        </p>
      ) : null}
    </div>
  );
}

function InheritToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-muted/40 flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
      <p className="text-sm font-semibold">{label}</p>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="border-border flex items-center justify-between gap-4 rounded-2xl border p-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-destructive text-xs font-medium">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-muted-foreground shrink-0 font-semibold">{label}</dt>
      <dd className="font-bold break-words sm:text-right">{value}</dd>
    </div>
  );
}
