"use client";

import { authClient } from "@loyalty/auth/client";
import { formatDate } from "@loyalty/date";
import {
  Button,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputPhone,
  isValidE164Phone,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
  Spinner,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import {
  AtSign,
  Camera,
  Check,
  ChevronRight,
  Coins,
  Gem,
  Gift,
  Globe,
  HelpCircle,
  type LucideIcon,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Pencil,
  Phone,
  Receipt,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { parsePhoneNumber } from "libphonenumber-js";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CurrencySwitcher } from "@/components/currency-switcher";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LoyaltyImage } from "@/components/loyalty-image";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePhoneOtp } from "@/features/auth/hooks/use-phone-otp";
import { Link, useRouter } from "@/i18n/navigation";
import { getAppUrl } from "@/lib/app-url";
import { useCurrency } from "@/lib/currency";
import { useTRPC } from "@/lib/trpc/client";

import {
  APP_VERSION,
  AVATAR_ACCEPT,
  AVATAR_MAX_BYTES,
  type TeaAvatar,
  teaAvatars,
} from "../data";
import { AvatarCropper } from "./avatar-cropper";
import { NotificationPreferences } from "./notification-preferences";

type DrawerKind = "name" | "nick" | "avatar" | "phone" | "unlink" | "signout" | null;

/** Local mirror of the avatar so edits feel instant before the query refetches. */
type AvatarMirror =
  | { kind: "preset"; preset: string }
  | { kind: "custom"; url: string; thumbhash: string | null }
  | { kind: "clear" };

export function ProfileScreen() {
  const t = useTranslations("Profile");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { enabledLocales, enabledCurrencies } = useCurrency();
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const meQuery = useQuery(trpc.profile.me.queryOptions());
  const me = meQuery.data;

  const invalidateMe = () =>
    queryClient.invalidateQueries(trpc.profile.me.queryFilter());

  const updateName = useMutation(trpc.profile.updateName.mutationOptions());
  const updateNickname = useMutation(
    trpc.profile.updateNickname.mutationOptions(),
  );
  const updateAvatar = useMutation(trpc.profile.updateAvatar.mutationOptions());
  const confirmPhoneChange = useMutation(
    trpc.profile.confirmPhoneChange.mutationOptions(),
  );
  const syncEmail = useMutation(trpc.profile.syncEmail.mutationOptions());

  // Optimistic mirrors — seeded from the query, overridden by in-flight edits.
  const [nameMirror, setNameMirror] = useState<string | null>(null);
  const [nickMirror, setNickMirror] = useState<string | null>(null);
  const [avatarMirror, setAvatarMirror] = useState<AvatarMirror | null>(null);

  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [googleLinking, setGoogleLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // After a Google link redirect lands back here, mirror the Google email onto
  // the customer row. It's a no-op when the account isn't linked, so calling it
  // once on mount is safe.
  const syncEmailRef = useRef(syncEmail);
  syncEmailRef.current = syncEmail;
  useEffect(() => {
    syncEmailRef.current
      .mutateAsync()
      .then(() => invalidateMe())
      .catch(() => {});
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = nameMirror ?? me?.name ?? "";
  const nick = nickMirror ?? me?.nickname ?? "";
  const memberSinceText = me ? formatDate(me.memberSince, { locale }) : "";
  // Signup seeds `name` to the raw phone (Better Auth temp name) — treat a
  // phone-looking name as "no name" everywhere (hero, row, edit prefill).
  const hasRealName =
    !!name && name !== me?.phone && !/^\+?[\d\s()-]+$/.test(name);
  const displayName = hasRealName ? name : "";

  // Resolve the avatar to render: optimistic mirror first, else the server row.
  const avatarPreset = avatarMirror
    ? avatarMirror.kind === "preset"
      ? avatarMirror.preset
      : null
    : me?.avatarPreset ?? null;
  const avatarUrl = avatarMirror
    ? avatarMirror.kind === "custom"
      ? avatarMirror.url
      : null
    : me?.avatarUrl ?? null;
  const avatarThumbhash = avatarMirror
    ? avatarMirror.kind === "custom"
      ? avatarMirror.thumbhash
      : null
    : me?.avatarThumbhash ?? null;

  const googleLinked = me?.googleLinked ?? false;
  const hasRealEmail = me?.hasRealEmail ?? false;

  const openEdit = (kind: "name" | "nick") => setDrawer(kind);

  const saveName = async (value: string) => {
    const next = value.trim();
    if (!next || next === name) {
      setDrawer(null);
      return;
    }
    setNameMirror(next);
    setDrawer(null);
    try {
      await updateName.mutateAsync({ name: next });
      invalidateMe();
    } catch {
      setNameMirror(null);
      toast.error(t("saveFailed"));
    }
  };

  const saveNick = async (value: string) => {
    if (value === nick) {
      setDrawer(null);
      return;
    }
    setNickMirror(value);
    setDrawer(null);
    try {
      await updateNickname.mutateAsync({ nickname: value });
      invalidateMe();
    } catch (err) {
      setNickMirror(null);
      const code =
        err && typeof err === "object" && "data" in err
          ? (err as { data?: { code?: string } }).data?.code
          : undefined;
      toast.error(code === "CONFLICT" ? t("nickTaken") : t("saveFailed"));
    }
  };

  // ===== Avatar =====
  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!AVATAR_ACCEPT.includes(file.type as (typeof AVATAR_ACCEPT)[number])) {
      toast.error(t("avatarErrorType"));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(
        t("avatarErrorSize", { mb: AVATAR_MAX_BYTES / (1024 * 1024) }),
      );
      return;
    }
    setPendingFile(file);
  };

  const onPickPreset = async (presetId: string) => {
    setAvatarMirror({ kind: "preset", preset: presetId });
    try {
      await updateAvatar.mutateAsync({ kind: "preset", preset: presetId });
      invalidateMe();
    } catch {
      setAvatarMirror(null);
      toast.error(t("saveFailed"));
    }
  };

  const onCropUploaded = async (result: {
    url: string;
    thumbhash: string | null;
  }) => {
    setPendingFile(null);
    setAvatarMirror({ kind: "custom", url: result.url, thumbhash: result.thumbhash });
    try {
      await updateAvatar.mutateAsync({
        kind: "custom",
        avatarUrl: result.url,
        avatarThumbhash: result.thumbhash,
      });
      invalidateMe();
    } catch {
      setAvatarMirror(null);
      toast.error(t("saveFailed"));
    }
  };

  const onClearAvatar = async () => {
    setAvatarMirror({ kind: "clear" });
    try {
      await updateAvatar.mutateAsync({ kind: "clear" });
      invalidateMe();
    } catch {
      setAvatarMirror(null);
      toast.error(t("saveFailed"));
    }
  };

  // ===== Google link / unlink =====
  const onLinkGoogle = async () => {
    setGoogleLinking(true);
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: `${getAppUrl()}/profile`,
    });
    if (error) {
      setGoogleLinking(false);
      toast.error(t("googleLinkFailed"));
    }
  };

  const onUnlinkGoogle = async () => {
    setUnlinking(true);
    const { error } = await authClient.unlinkAccount({ providerId: "google" });
    setUnlinking(false);
    setDrawer(null);
    if (error) {
      toast.error(t("googleLinkFailed"));
      return;
    }
    invalidateMe();
  };

  const onSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  const maskedPhone = me?.phone ? maskPhone(me.phone) : "";
  const phoneFlag = me?.phone ? phoneToFlag(me.phone) : "";
  // The hero never shows the raw phone: a real name if set, else the country
  // flag + masked number.
  const heroName = displayName || `${phoneFlag} ${maskedPhone}`.trim() || "—";
  // Compact, locale-aware points (es "13,9 mil" / en "13.9K") past 10k, matching
  // the home points ring.
  const points = me?.stats.points ?? 0;
  const pointsText =
    points >= 10_000
      ? format.number(points, { notation: "compact", maximumFractionDigits: 1 })
      : format.number(points);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>

      {/* HEADER */}
      <section className="from-primary to-primary/75 shadow-primary/30 relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-xl">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-5 -bottom-8 -rotate-12 text-9xl opacity-15"
        >
          🍃
        </span>
        <div className="relative flex items-center gap-4">
          <button
            type="button"
            onClick={() => setDrawer("avatar")}
            aria-label={t("avatarTitle")}
            className="relative size-18 flex-none"
          >
            <AvatarFace
              avatarUrl={avatarUrl}
              avatarThumbhash={avatarThumbhash}
              avatarPreset={avatarPreset}
              name={displayName}
            />
            <span className="border-primary text-primary absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border-2 bg-white">
              <Camera className="size-3.5" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-2xl font-semibold tracking-tight">
              {heroName}
            </p>
            <p className="text-sm text-white/85">
              {nick ? `@${nick} · ` : ""}
              {t("memberSince", { date: memberSinceText })}
            </p>
          </div>
        </div>
        <div className="relative mt-4 flex gap-2.5">
          <Stat label={t("statPoints")} value={pointsText} />
          <Stat label={t("statTier")} value={me?.stats.tierName ?? "—"} />
          <Stat
            label={t("statVisits")}
            value={format.number(me?.stats.visits ?? 0)}
          />
        </div>
      </section>

      {/* ACCOUNT */}
      <Section label={t("secAccount")}>
        <Row
          icon={User}
          label={t("rowName")}
          value={displayName || t("addName")}
          edit
          onClick={() => openEdit("name")}
        />
        <Row
          icon={AtSign}
          label={t("rowNick")}
          value={nick ? `@${nick}` : "—"}
          edit
          onClick={() => openEdit("nick")}
        />
        <Row
          icon={Phone}
          label={t("rowPhone")}
          value={maskedPhone}
          edit
          onClick={() => setDrawer("phone")}
        />
        {hasRealEmail ? (
          <Row icon={Mail} label={t("rowEmail")} sub={me?.email ?? undefined}>
            <span className="bg-primary/10 text-primary inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold">
              <Check className="size-3.5" />
              {t("verified")}
            </span>
          </Row>
        ) : (
          <Row icon={Mail} label={t("rowEmail")} sub={t("connectGoogleForEmail")}>
            <button
              type="button"
              onClick={() => void onLinkGoogle()}
              disabled={googleLinking}
              className="bg-primary text-primary-foreground shrink-0 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50"
            >
              {t("link")}
            </button>
          </Row>
        )}
        <Row
          iconText="G"
          label="Google"
          sub={googleLinked ? t("googleLinkedSub") : t("googleSub")}
        >
          <button
            type="button"
            onClick={() =>
              googleLinked ? setDrawer("unlink") : void onLinkGoogle()
            }
            disabled={googleLinking}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
              googleLinked
                ? "border border-rose-300 text-rose-500"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {googleLinked ? t("unlink") : t("link")}
          </button>
        </Row>
        <Row
          icon={Gem}
          label={t("tierPerks", { tier: me?.stats.tierName ?? "" })}
          sub={t("tierPerksSub")}
          href="/rewards"
          chevron
        />
        <Row
          icon={MapPin}
          label={t("rowStore")}
          sub={t("rowStoreSub")}
          href="/store"
          chevron
        />
      </Section>

      {/* NOTIFICATIONS — the real per-channel opt-out control */}
      <div>
        <NotificationPreferences />
      </div>

      {/* PREFERENCES */}
      <Section label={t("preferences.title")}>
        {enabledLocales.length > 1 ? (
          <div className="flex items-center gap-3.5 px-4 py-3">
            <span className="bg-primary/10 grid size-10 flex-none place-items-center rounded-xl">
              <Globe className="text-primary size-5" />
            </span>
            <span className="flex-1 text-sm font-bold">
              {t("preferences.language")}
            </span>
            <LocaleSwitcher />
          </div>
        ) : null}
        {enabledCurrencies.length > 1 ? (
          <div className="border-border flex items-center gap-3.5 border-t px-4 py-3">
            <span className="bg-primary/10 grid size-10 flex-none place-items-center rounded-xl">
              <Coins className="text-primary size-5" />
            </span>
            <span className="flex-1 text-sm font-bold">
              {t("preferences.currency")}
            </span>
            <CurrencySwitcher />
          </div>
        ) : null}
        <div className="border-border flex items-center gap-3.5 border-t px-4 py-3">
          <span className="bg-primary/10 grid size-10 flex-none place-items-center rounded-xl">
            <Moon className="text-primary size-5" />
          </span>
          <span className="flex-1 text-sm font-bold">
            {t("preferences.theme")}
          </span>
          <ThemeToggle />
        </div>
      </Section>

      {/* ACTIVITY */}
      <Section label={t("secActivity")}>
        <Row
          icon={Receipt}
          label={t("purchaseHistory")}
          sub={t("purchaseHistorySub")}
          href="/compras"
          chevron
        />
        <Row
          icon={Gift}
          label={t("rewardsHistory")}
          sub={t("rewardsHistorySub")}
          href="/rewards/history"
          chevron
        />
      </Section>

      {/* HELP + SIGN OUT */}
      <Section>
        <Row icon={HelpCircle} label={t("help")} chevron />
        <button
          type="button"
          onClick={() => setDrawer("signout")}
          className="flex w-full items-center gap-3.5 px-4 py-4 text-left text-rose-500"
        >
          <span className="grid size-10 flex-none place-items-center rounded-xl bg-rose-500/10">
            <LogOut className="size-5" />
          </span>
          <span className="flex-1 text-sm font-bold">{t("signOut")}</span>
          <ChevronRight className="size-5 shrink-0 text-rose-500/40" />
        </button>
      </Section>

      <p className="text-muted-foreground text-center text-xs">{APP_VERSION}</p>

      <input
        ref={fileRef}
        type="file"
        accept={AVATAR_ACCEPT.join(",")}
        onChange={onPickFile}
        className="hidden"
      />

      {/* ===== NAME / NICK DRAWER ===== */}
      <ResponsiveModal
        open={drawer === "name" || drawer === "nick"}
        onOpenChange={(open) => !open && setDrawer(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {drawer === "nick" ? t("rowNick") : t("rowName")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
              {drawer === "nick" ? t("editNickHint") : t("editNameHint")}
            </ResponsiveModalDescription>
            {drawer === "nick" ? (
              <NickForm currentNick={nick} onSave={saveNick} />
            ) : drawer === "name" ? (
              <NameForm defaultValue={displayName} onSave={saveName} />
            ) : null}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ===== AVATAR DRAWER ===== */}
      <ResponsiveModal
        open={drawer === "avatar"}
        onOpenChange={(open) => {
          if (!open) {
            setDrawer(null);
            setPendingFile(null);
          }
        }}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          {pendingFile ? (
            <AvatarCropper
              file={pendingFile}
              onUploaded={(r) => void onCropUploaded(r)}
              onCancel={() => setPendingFile(null)}
            />
          ) : (
            <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
                {t("avatarTitle")}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
                {t("avatarHint")}
              </ResponsiveModalDescription>
              <div className="mt-4 grid grid-cols-4 gap-3">
                {teaAvatars.map((a) => {
                  const active =
                    !avatarUrl && (avatarPreset ?? teaAvatars[0]!.id) === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => void onPickPreset(a.id)}
                      aria-pressed={active}
                      style={{
                        backgroundImage: `linear-gradient(150deg, ${a.gradient[0]}, ${a.gradient[1]})`,
                      }}
                      className={`grid aspect-square place-items-center rounded-full text-3xl ${
                        active
                          ? "ring-primary ring-offset-background ring-2 ring-offset-2"
                          : ""
                      }`}
                    >
                      {a.emoji}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label={t("avatarUpload")}
                  className={`border-border text-muted-foreground relative grid aspect-square place-items-center overflow-hidden rounded-full border-2 border-dashed ${
                    avatarUrl
                      ? "ring-primary ring-offset-background ring-2 ring-offset-2"
                      : ""
                  }`}
                >
                  {avatarUrl ? (
                    <LoyaltyImage
                      src={avatarUrl}
                      thumbhash={avatarThumbhash}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <Upload className="size-5" />
                  )}
                </button>
              </div>
              {avatarUrl || avatarPreset ? (
                <button
                  type="button"
                  onClick={() => void onClearAvatar()}
                  className="text-muted-foreground mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
                >
                  <Trash2 className="size-4" />
                  {t("avatarRemove")}
                </button>
              ) : null}
              <Button
                onClick={() => setDrawer(null)}
                variant="gradient"
                size="lg"
                className="mt-5 h-14 w-full rounded-full"
              >
                {t("done")}
              </Button>
            </div>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ===== PHONE CHANGE DRAWER ===== */}
      <PhoneChangeModal
        open={drawer === "phone"}
        currentPhone={me?.phone ?? ""}
        onClose={() => setDrawer(null)}
        onChanged={async (newPhone) => {
          await confirmPhoneChange.mutateAsync({ newPhone });
          invalidateMe();
          setDrawer(null);
          toast.success(t("phoneChangeSuccess"));
        }}
      />

      {/* ===== UNLINK GOOGLE CONFIRM ===== */}
      <ResponsiveModal
        open={drawer === "unlink"}
        onOpenChange={(open) => !open && setDrawer(null)}
      >
        <ResponsiveModalContent
          aria-describedby={undefined}
          mobileClassName="mx-auto w-full max-w-md"
        >
          <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("unlinkGoogleConfirm")}
            </ResponsiveModalTitle>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {t("unlinkGoogleMessage")}
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setDrawer(null)}
                className="flex-1 rounded-full font-semibold"
              >
                {t("cancel")}
              </Button>
              <Button
                size="lg"
                disabled={unlinking}
                onClick={() => void onUnlinkGoogle()}
                className="flex-1 rounded-full bg-rose-500 font-semibold text-white hover:bg-rose-500/90"
              >
                {t("unlink")}
              </Button>
            </div>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ===== SIGN OUT ===== */}
      <ResponsiveModal
        open={drawer === "signout"}
        onOpenChange={(open) => !open && setDrawer(null)}
      >
        <ResponsiveModalContent
          aria-describedby={undefined}
          mobileClassName="mx-auto w-full max-w-md"
        >
          <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("signOutConfirm")}
            </ResponsiveModalTitle>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {t("signOutMessage")}
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setDrawer(null)}
                className="flex-1 rounded-full font-semibold"
              >
                {t("cancel")}
              </Button>
              <Button
                size="lg"
                disabled={signingOut}
                onClick={() => void onSignOut()}
                className="flex-1 rounded-full bg-rose-500 font-semibold text-white hover:bg-rose-500/90"
              >
                {t("signOut")}
              </Button>
            </div>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

/** Multi-step phone-change flow: prove current number → verify new number. */
function PhoneChangeModal({
  open,
  currentPhone,
  onClose,
  onChanged,
}: {
  open: boolean;
  currentPhone: string;
  onClose: () => void;
  onChanged: (newPhone: string) => Promise<void>;
}) {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const proveOtp = usePhoneOtp();
  const newOtp = usePhoneOtp();

  type Step = "prove" | "proveCode" | "new" | "newCode";
  const [step, setStep] = useState<Step>("prove");
  const [code, setCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset on close.
  useEffect(() => {
    if (open) return;
    setStep("prove");
    setCode("");
    setNewPhone("");
    setError(null);
    setSubmitting(false);
    proveOtp.reset();
    newOtp.reset();
    // proveOtp/newOtp identities are stable enough; reset on open/close only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startProve = async () => {
    setError(null);
    const ok = await proveOtp.requestOtp(currentPhone);
    if (ok) {
      setCode("");
      setStep("proveCode");
    } else {
      setError(t("saveFailed"));
    }
  };

  const verifyProve = async () => {
    if (code.length !== 6) return;
    setError(null);
    const ok = await proveOtp.verifyOtp(code);
    if (ok) {
      setCode("");
      setStep("new");
    } else {
      setError(t("phoneVerifyError"));
    }
  };

  const startNew = async () => {
    setError(null);
    if (!isValidE164Phone(newPhone)) {
      setError(t("phoneInvalid"));
      return;
    }
    // Catch the "no-op" cases at the input — before burning an OTP: the user's
    // own current number, or a number already taken by someone else.
    if (newPhone === currentPhone) {
      setError(t("phoneSameAsCurrent"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await queryClient.fetchQuery(
        trpc.auth.phoneAvailable.queryOptions({ phone: newPhone }),
      );
      if (!res.available) {
        setError(t("phoneTakenError"));
        return;
      }
      const ok = await newOtp.requestOtp(newPhone);
      if (ok) {
        setCode("");
        setStep("newCode");
      } else {
        setError(t("saveFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const verifyNew = async () => {
    if (code.length !== 6) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await newOtp.verifyOtp(code, { updatePhoneNumber: true });
      if (!ok) {
        setError(t("phoneVerifyError"));
        return;
      }
      await onChanged(newPhone);
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    step === "prove" || step === "proveCode"
      ? t("phoneProveCurrentTitle")
      : t("phoneNewTitle");

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
            {t("phoneChangeTitle")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
            {title}
          </ResponsiveModalDescription>

          {step === "prove" && (
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void startProve();
              }}
            >
              <p className="text-muted-foreground text-sm">
                {t("phoneProveCurrentHint", { phone: maskPhone(currentPhone) })}
              </p>
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                disabled={proveOtp.isSending}
                className="mt-4 h-14 w-full gap-2 rounded-full"
              >
                {proveOtp.isSending ? <Spinner className="size-5" /> : null}
                {t("phoneVerify")}
              </Button>
            </form>
          )}

          {(step === "proveCode" || step === "newCode") && (
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void (step === "proveCode" ? verifyProve() : verifyNew());
              }}
            >
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  autoFocus
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="rounded-2xl" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <ResendRow
                otp={step === "proveCode" ? proveOtp : newOtp}
                label={t("phoneOtpResend")}
              />
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                disabled={
                  code.length !== 6 ||
                  submitting ||
                  proveOtp.isVerifying ||
                  newOtp.isVerifying
                }
                className="mt-4 h-14 w-full gap-2 rounded-full"
              >
                {submitting ||
                proveOtp.isVerifying ||
                newOtp.isVerifying ? (
                  <Spinner className="size-5" />
                ) : null}
                {t("phoneVerify")}
              </Button>
            </form>
          )}

          {step === "new" && (
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void startNew();
              }}
            >
              <p className="text-muted-foreground mb-3 text-sm">
                {t("phoneNewHint")}
              </p>
              <InputPhone
                defaultCountry="CO"
                locale={locale}
                value={newPhone}
                onChange={(v) => {
                  setNewPhone(v.e164);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
                autoFocus
              />
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                disabled={submitting || newOtp.isSending}
                className="mt-4 h-14 w-full gap-2 rounded-full"
              >
                {submitting || newOtp.isSending ? (
                  <Spinner className="size-5" />
                ) : null}
                {t("phoneVerify")}
              </Button>
            </form>
          )}

          {error ? (
            <p className="text-destructive mt-3 text-center text-sm font-semibold">
              {error}
            </p>
          ) : null}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function ResendRow({
  otp,
  label,
}: {
  otp: ReturnType<typeof usePhoneOtp>;
  label: string;
}) {
  return (
    <div className="mt-3 text-center">
      <button
        type="button"
        onClick={() => void otp.resendOtp()}
        disabled={!otp.canResend || otp.isSending}
        className="text-primary disabled:text-muted-foreground/70 text-sm font-semibold disabled:cursor-not-allowed"
      >
        {otp.canResend ? label : `${label} (${otp.secondsLeft}s)`}
      </button>
    </div>
  );
}

/** Name editor — react-hook-form + zod; Enter submits via `<form onSubmit>`. */
function NameForm({
  defaultValue,
  onSave,
}: {
  defaultValue: string;
  onSave: (value: string) => void | Promise<void>;
}) {
  const t = useTranslations("Profile");
  const form = useForm<{ name: string }>({
    resolver: zodResolver(z.object({ name: z.string().trim().min(1).max(60) })),
    defaultValues: { name: defaultValue },
    mode: "onChange",
  });

  return (
    <form
      onSubmit={form.handleSubmit(({ name }) => void onSave(name.trim()))}
    >
      <Input
        {...form.register("name")}
        className="mt-4 h-14 rounded-xl"
        autoFocus
      />
      <Button
        type="submit"
        variant="gradient"
        size="lg"
        disabled={!form.formState.isValid}
        className="mt-4 h-14 w-full rounded-full"
      >
        {t("save")}
      </Button>
    </form>
  );
}

/** Nickname editor — react-hook-form + zod, with the live availability check.
 *  Enter submits; the button blocks while checking / when taken. */
function NickForm({
  currentNick,
  onSave,
}: {
  currentNick: string;
  onSave: (value: string) => void | Promise<void>;
}) {
  const t = useTranslations("Profile");
  const trpc = useTRPC();
  const form = useForm<{ nickname: string }>({
    resolver: zodResolver(
      z.object({ nickname: z.string().regex(/^[a-z0-9_]{3,20}$/) }),
    ),
    defaultValues: { nickname: currentNick },
    mode: "onChange",
  });

  const value = form.watch("nickname") || "";
  const debounced = useDebounce(value, { wait: 400 });
  const valid = /^[a-z0-9_]{3,20}$/.test(debounced);
  const isSelf = debounced === currentNick;
  const check = useQuery({
    ...trpc.profile.checkNickname.queryOptions({ nickname: debounced }),
    enabled: valid && !isSelf,
  });
  const checking = valid && !isSelf && (check.isFetching || debounced !== value);
  const available = isSelf || check.data?.available === true;
  const blocked = !valid || checking || (!isSelf && !available);

  return (
    <form
      onSubmit={form.handleSubmit(({ nickname }) => {
        if (!blocked) void onSave(nickname);
      })}
    >
      <Input
        {...form.register("nickname", {
          // Normalize as the user types so the stored (and validated) value is
          // always `@`-stripped + lowercase.
          setValueAs: (v) =>
            String(v ?? "")
              .replace(/^@/, "")
              .toLowerCase(),
        })}
        className="mt-4 h-14 rounded-xl lowercase"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
      />
      <NickStatus
        checking={checking}
        valid={valid}
        available={available}
        isSelf={isSelf}
        empty={value.length === 0}
      />
      <Button
        type="submit"
        variant="gradient"
        size="lg"
        disabled={blocked}
        className="mt-4 h-14 w-full rounded-full"
      >
        {t("save")}
      </Button>
    </form>
  );
}

function NickStatus({
  checking,
  valid,
  available,
  isSelf,
  empty,
}: {
  checking: boolean;
  valid: boolean;
  available: boolean;
  isSelf: boolean;
  empty: boolean;
}) {
  const t = useTranslations("Profile");
  if (empty || isSelf) {
    return (
      <p className="text-muted-foreground mt-2 text-xs">{t("nickHintRules")}</p>
    );
  }
  if (!valid) {
    return (
      <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-500">
        <X className="size-3.5" />
        {t("nickInvalid")}
      </p>
    );
  }
  if (checking) {
    return (
      <p className="text-muted-foreground mt-2 inline-flex items-center gap-1.5 text-xs">
        <Spinner className="size-3.5" />
        {t("nickChecking")}
      </p>
    );
  }
  if (available) {
    return (
      <p className="text-primary mt-2 inline-flex items-center gap-1 text-xs font-semibold">
        <Check className="size-3.5" />
        {t("nickAvailable")}
      </p>
    );
  }
  return (
    <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-500">
      <X className="size-3.5" />
      {t("nickTaken")}
    </p>
  );
}

function AvatarFace({
  avatarUrl,
  avatarThumbhash,
  avatarPreset,
  name,
}: {
  avatarUrl: string | null;
  avatarThumbhash: string | null;
  avatarPreset: string | null;
  name: string;
}) {
  // Fall back to the placeholder if the photo fails to load (e.g. an expired
  // dev URL or a deleted object) instead of showing a broken-image icon.
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [avatarUrl]);

  if (avatarUrl && !imgError) {
    return (
      <span className="absolute inset-0 overflow-hidden rounded-full shadow-md">
        <LoyaltyImage
          src={avatarUrl}
          thumbhash={avatarThumbhash}
          alt=""
          fill
          sizes="72px"
          className="object-cover"
          onError={() => setImgError(true)}
        />
      </span>
    );
  }
  if (avatarPreset) {
    const preset =
      teaAvatars.find((a) => a.id === avatarPreset) ?? teaAvatars[0]!;
    return <PresetFace avatar={preset} />;
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (!initials) return <PresetFace avatar={teaAvatars[0]!} />;
  return (
    <span className="bg-primary/20 absolute inset-0 grid size-full place-items-center rounded-full text-2xl font-bold text-white shadow-md">
      {initials}
    </span>
  );
}

function PresetFace({ avatar }: { avatar: TeaAvatar }) {
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(150deg, ${avatar.gradient[0]}, ${avatar.gradient[1]})`,
      }}
      className="absolute inset-0 grid size-full place-items-center rounded-full text-4xl shadow-md"
    >
      {avatar.emoji}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 rounded-2xl bg-white/15 p-3">
      <p className="text-xs font-bold tracking-wider text-white/80">{label}</p>
      <p className="font-display mt-1 text-2xl leading-none font-semibold">
        {value}
      </p>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {label ? (
        <p className="text-muted-foreground mb-2.5 px-1 text-xs font-bold tracking-wider">
          {label}
        </p>
      ) : null}
      <div className="bg-card divide-border divide-y overflow-hidden rounded-3xl shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        {children}
      </div>
    </section>
  );
}

function Row({
  icon: Icon,
  iconText,
  label,
  sub,
  value,
  edit,
  chevron,
  href,
  onClick,
  children,
}: {
  icon?: LucideIcon;
  iconText?: string;
  label: string;
  sub?: string;
  value?: string;
  edit?: boolean;
  chevron?: boolean;
  href?: "/rewards" | "/store" | "/compras" | "/rewards/history";
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-xl text-base font-bold">
        {Icon ? <Icon className="size-5" /> : iconText}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground text-sm font-bold">{label}</span>
        {sub ? (
          <span className="text-muted-foreground truncate text-xs">{sub}</span>
        ) : null}
      </div>
      {value ? (
        <span className="text-muted-foreground shrink-0 text-sm">{value}</span>
      ) : null}
      {children}
      {edit ? <Pencil className="text-primary size-4 shrink-0" /> : null}
      {chevron ? (
        <ChevronRight className="text-muted-foreground/50 size-5 shrink-0" />
      ) : null}
    </>
  );
  const cls = "flex w-full items-center gap-3.5 px-4 py-4 text-left";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** Masks all but the last 4 digits of an E.164 phone for display. */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `•••• ${phone.slice(-4)}`;
}

/** Country flag emoji for a phone's region (e.g. +57… → 🇨🇴). Empty when the
 *  number can't be parsed. */
function phoneToFlag(phone: string): string {
  try {
    const country = parsePhoneNumber(phone)?.country;
    if (!country) return "";
    return String.fromCodePoint(
      ...[...country].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
    );
  } catch {
    return "";
  }
}
