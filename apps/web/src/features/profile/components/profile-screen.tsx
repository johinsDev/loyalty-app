"use client";

import { authClient } from "@loyalty/auth/client";
import {
  Button,
  DateWheelPicker,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import {
  AtSign,
  Cake,
  Camera,
  Check,
  ChevronRight,
  Gem,
  Gift,
  Coins,
  Globe,
  HelpCircle,
  type LucideIcon,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Pencil,
  Receipt,
  Upload,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { CurrencySwitcher } from "@/components/currency-switcher";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useCurrency } from "@/lib/currency";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link, useRouter } from "@/i18n/navigation";
import { useFadeUp } from "@/lib/animate";

import {
  APP_VERSION,
  AVATAR_ACCEPT,
  AVATAR_MAX_BYTES,
  profile,
  type TeaAvatar,
  teaAvatars,
} from "../data";
import { NotificationPreferences } from "./notification-preferences";

type DrawerKind = "name" | "nick" | "birthday" | "avatar" | "signout" | null;

export function ProfileScreen() {
  const t = useTranslations("Profile");
  const { enabledLocales, enabledCurrencies } = useCurrency();
  const fade = useFadeUp();
  const locale = useLocale();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState<string>(profile.name);
  const [nick, setNick] = useState<string>(profile.nickname);
  const [birthday, setBirthday] = useState<{
    month: number;
    day: number;
    year: number;
  }>(profile.birthday);
  const [avatarId, setAvatarId] = useState<string>(teaAvatars[0]!.id);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState<boolean>(
    profile.googleLinked,
  );
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [draft, setDraft] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, opts);
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    fmt({ month: "long" }).format(new Date(2000, i, 1)),
  );
  const birthdayText = fmt({
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(birthday.year, birthday.month - 1, birthday.day));
  const avatar = teaAvatars.find((a) => a.id === avatarId) ?? teaAvatars[0]!;

  const openEdit = (kind: "name" | "nick") => {
    setDraft(kind === "name" ? name : nick);
    setDrawer(kind);
  };
  const saveEdit = () => {
    const v = draft.trim();
    if (drawer === "name") setName(v || profile.name);
    else if (drawer === "nick") setNick((v || nick).replace(/^@/, ""));
    setDrawer(null);
  };

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
    setCustomAvatar(URL.createObjectURL(file));
    setDrawer(null);
  };

  const onSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>

      {/* HEADER */}
      <section
        style={fade(0)}
        className="from-primary to-primary/75 relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-xl shadow-primary/30"
      >
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
            <AvatarFace avatar={avatar} custom={customAvatar} />
            <span className="border-primary text-primary absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border-2 bg-white">
              <Camera className="size-3.5" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-2xl font-semibold tracking-tight">
              {name}
            </p>
            <p className="truncate text-sm text-white/85">
              @{nick} · {t("memberSince", { date: profile.memberSince })}
            </p>
          </div>
        </div>
        <div className="relative mt-4 flex gap-2.5">
          <Stat label={t("statPoints")} value={profile.points} />
          <Stat label={t("statTier")} value={profile.tier} />
          <Stat label={t("statVisits")} value={profile.visits} />
        </div>
      </section>

      {/* ACCOUNT */}
      <Section label={t("secAccount")} style={fade(1)}>
        <Row
          icon={User}
          label={t("rowName")}
          value={name}
          edit
          onClick={() => openEdit("name")}
        />
        <Row
          icon={AtSign}
          label={t("rowNick")}
          value={`@${nick}`}
          edit
          onClick={() => openEdit("nick")}
        />
        <Row icon={Mail} label={t("rowEmail")} sub={profile.email}>
          <span className="bg-primary/10 text-primary inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold">
            <Check className="size-3.5" />
            {t("verified")}
          </span>
        </Row>
        <Row
          icon={Cake}
          label={t("rowBirthday")}
          sub={t("birthdaySub")}
          value={birthdayText}
          edit
          onClick={() => setDrawer("birthday")}
        />
        <Row
          iconText="G"
          label="Google"
          sub={googleLinked ? t("googleLinkedSub") : t("googleSub")}
        >
          <button
            type="button"
            onClick={() => setGoogleLinked((g) => !g)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
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
          label={t("tierPerks", { tier: profile.tier })}
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
      <div style={fade(2)}>
        <NotificationPreferences />
      </div>

      {/* PREFERENCES */}
      <Section label={t("preferences.title")} style={fade(3)}>
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
      <Section label={t("secActivity")} style={fade(4)}>
        <Row
          icon={Receipt}
          label={t("purchaseHistory")}
          sub={t("purchaseHistorySub")}
          href="/rewards"
          chevron
        />
        <Row
          icon={Gift}
          label={t("rewardsHistory")}
          sub={t("rewardsHistorySub")}
          href="/rewards"
          chevron
        />
      </Section>

      {/* HELP + SIGN OUT */}
      <Section style={fade(5)}>
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

      {/* ===== DRAWERS ===== */}
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
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="mt-4 h-12 rounded-xl"
              autoFocus
            />
            <Button
              onClick={saveEdit}
              variant="gradient"
              size="lg"
              className="mt-4 h-12 w-full rounded-full"
            >
              {t("save")}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={drawer === "birthday"}
        onOpenChange={(open) => !open && setDrawer(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("birthdayTitle")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
              {t("birthdayHint")}
            </ResponsiveModalDescription>
            <DateWheelPicker
              className="mt-4"
              value={birthday}
              onValueChange={setBirthday}
              monthLabels={monthNames}
              dayLabel={t("dayLabel")}
              monthLabel={t("monthLabel")}
              yearLabel={t("yearLabel")}
              maxYear={new Date().getFullYear()}
            />
            <Button
              onClick={() => setDrawer(null)}
              variant="gradient"
              size="lg"
              className="mt-5 h-12 w-full rounded-full"
            >
              {t("done")} · {birthdayText}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={drawer === "avatar"}
        onOpenChange={(open) => !open && setDrawer(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("avatarTitle")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
              {t("avatarHint")}
            </ResponsiveModalDescription>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {teaAvatars.map((a) => {
                const active = !customAvatar && a.id === avatarId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setCustomAvatar(null);
                      setAvatarId(a.id);
                    }}
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
                  customAvatar
                    ? "ring-primary ring-offset-background ring-2 ring-offset-2"
                    : ""
                }`}
              >
                {customAvatar ? (
                  <img
                    src={customAvatar}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <Upload className="size-5" />
                )}
              </button>
            </div>
            <Button
              onClick={() => setDrawer(null)}
              variant="gradient"
              size="lg"
              className="mt-5 h-12 w-full rounded-full"
            >
              {t("done")}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

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

function AvatarFace({
  avatar,
  custom,
}: {
  avatar: TeaAvatar;
  custom: string | null;
}) {
  if (custom) {
    return (
      <img
        src={custom}
        alt=""
        className="absolute inset-0 size-full rounded-full object-cover shadow-md"
      />
    );
  }
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
  style,
}: {
  label?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section style={style}>
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
  href?: "/rewards" | "/store";
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
