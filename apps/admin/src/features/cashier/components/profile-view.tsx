"use client";

import { authClient } from "@loyalty/auth/client";
import {
  Button,
  DateWheelPicker,
  type DateValue,
  Input,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import {
  Cake,
  Camera,
  ChevronRight,
  KeyRound,
  LogOut,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "@/i18n/navigation";

import {
  AVATAR_ACCEPT,
  AVATAR_MAX_BYTES,
  cashier,
  teaAvatars,
} from "../data";

type EditField = "name" | "nick" | null;

/**
 * Perfil tab — the cashier configures their own account (avatar, name, nickname,
 * birthday) and preferences (language, theme), changes the shift PIN and signs
 * out. Name/nickname edit in a modal and the avatar (predefined tea avatars or
 * a custom upload) match the customer profile. Design-first: local until the
 * cashier-account backend lands.
 */
export function ProfileView() {
  const t = useTranslations("Cashier");
  const locale = useLocale();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(cashier.name);
  const [nick, setNick] = useState("lulifer");
  const [birthday, setBirthday] = useState<DateValue>({
    day: 9,
    month: 7,
    year: 1998,
  });
  const [avatarId, setAvatarId] = useState<string>(teaAvatars[0]!.id);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);

  const [edit, setEdit] = useState<EditField>(null);
  const [draft, setDraft] = useState("");
  const [bdayOpen, setBdayOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: "long" }).format(
      new Date(2000, i, 1),
    ),
  );
  const birthdayText = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(new Date(birthday.year, birthday.month - 1, birthday.day));
  const avatar = teaAvatars.find((a) => a.id === avatarId) ?? teaAvatars[0]!;

  const openEdit = (field: "name" | "nick") => {
    setDraft(field === "name" ? name : nick);
    setEdit(field);
  };
  const saveEdit = () => {
    const v = draft.trim();
    if (edit === "name") setName(v || cashier.name);
    else if (edit === "nick") setNick((v || nick).replace(/^@/, ""));
    setEdit(null);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!AVATAR_ACCEPT.includes(file.type as (typeof AVATAR_ACCEPT)[number])) {
      toast.error(t("avatarErrorType"));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(t("avatarErrorSize", { mb: AVATAR_MAX_BYTES / 1024 / 1024 }));
      return;
    }
    setCustomAvatar(URL.createObjectURL(file));
    setAvatarOpen(false);
  };

  const onSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <div className="mx-auto w-full max-w-md px-5 py-5">
      <input
        ref={fileRef}
        type="file"
        accept={AVATAR_ACCEPT.join(",")}
        onChange={onPickFile}
        className="hidden"
      />

      {/* Header */}
      <div className="bg-primary/10 flex items-center gap-4 rounded-3xl p-5">
        <button
          type="button"
          onClick={() => setAvatarOpen(true)}
          className="relative size-16 flex-none"
          aria-label={t("avatarTitle")}
        >
          <AvatarFace avatar={avatar} custom={customAvatar} />
          <span className="text-primary absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border-2 border-white bg-white">
            <Camera className="size-3" />
          </span>
        </button>
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold">{name}</div>
          <div className="text-muted-foreground text-sm font-semibold">
            @{nick}
          </div>
        </div>
      </div>

      {/* Account */}
      <Section label={t("profileAccount")}>
        <Row label={t("name")} value={name} onClick={() => openEdit("name")} />
        <Row
          label={t("nickname")}
          value={`@${nick}`}
          onClick={() => openEdit("nick")}
        />
        <Row
          icon={<Cake className="size-5" />}
          label={t("birthday")}
          value={birthdayText}
          onClick={() => setBdayOpen(true)}
        />
      </Section>

      {/* Preferences */}
      <Section label={t("preferences")}>
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-sm font-bold">{t("language")}</span>
          <LocaleSwitcher />
        </div>
        <div className="border-border flex items-center justify-between border-t px-4 py-3.5">
          <span className="text-sm font-bold">{t("theme")}</span>
          <ThemeToggle />
        </div>
      </Section>

      {/* Shift + session */}
      <Section>
        <Row
          icon={<KeyRound className="size-5" />}
          label={t("changePin")}
          onClick={() => {
            /* seam: shift-PIN keypad lands with the shift model */
          }}
        />
        <button
          type="button"
          onClick={() => void onSignOut()}
          disabled={signingOut}
          className="flex w-full items-center gap-3.5 px-4 py-4 text-left font-semibold text-rose-500 disabled:opacity-60"
        >
          <span className="grid size-10 flex-none place-items-center rounded-xl bg-rose-500/10">
            <LogOut className="size-5" />
          </span>
          {signingOut ? t("signingOut") : t("signOut")}
        </button>
      </Section>

      {/* Edit name / nick */}
      <ResponsiveModal
        open={edit !== null}
        onOpenChange={(o) => !o && setEdit(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex flex-col px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {edit === "nick" ? t("nickname") : t("name")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="sr-only">
              {edit === "nick" ? t("nickname") : t("name")}
            </ResponsiveModalDescription>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-4 h-12 rounded-xl"
              autoFocus
            />
            <Button
              variant="gradient"
              size="lg"
              onClick={saveEdit}
              className="mt-4 h-14 w-full rounded-2xl text-base font-extrabold"
            >
              {t("save")}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Birthday */}
      <ResponsiveModal open={bdayOpen} onOpenChange={setBdayOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex flex-col px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("birthday")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-1 mb-4 text-sm">
              {t("birthdayHint")}
            </ResponsiveModalDescription>
            <DateWheelPicker
              value={birthday}
              onValueChange={setBirthday}
              monthLabels={months}
              dayLabel={t("dayLabel")}
              monthLabel={t("monthLabel")}
              yearLabel={t("yearLabel")}
              maxYear={new Date().getFullYear()}
            />
            <ResponsiveModalClose
              variant="gradient"
              className="mt-5 h-14 w-full rounded-2xl text-base"
            >
              {t("done")}
            </ResponsiveModalClose>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Avatar */}
      <ResponsiveModal open={avatarOpen} onOpenChange={setAvatarOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex flex-col px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("avatarTitle")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-1 mb-4 text-sm">
              {t("avatarHint")}
            </ResponsiveModalDescription>
            <div className="grid grid-cols-4 gap-3">
              {teaAvatars.map((a) => {
                const active = !customAvatar && a.id === avatarId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setCustomAvatar(null);
                      setAvatarId(a.id);
                      setAvatarOpen(false);
                    }}
                    aria-pressed={active}
                    style={{
                      backgroundImage: `linear-gradient(150deg, ${a.gradient[0]}, ${a.gradient[1]})`,
                    }}
                    className={`grid aspect-square place-items-center rounded-full text-3xl ${active ? "ring-primary ring-offset-background ring-2 ring-offset-2" : ""}`}
                  >
                    {a.emoji}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={t("avatarUpload")}
                className={`border-border text-muted-foreground relative grid aspect-square place-items-center overflow-hidden rounded-full border-2 border-dashed ${customAvatar ? "ring-primary ring-offset-background ring-2 ring-offset-2" : ""}`}
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
            <ResponsiveModalClose
              variant="secondary"
              className="mt-6 h-14 w-full rounded-2xl text-base"
            >
              {t("done")}
            </ResponsiveModalClose>
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
  avatar: { emoji: string; gradient: readonly [string, string] };
  custom: string | null;
}) {
  if (custom) {
    return (
      <span className="relative block size-16 overflow-hidden rounded-full">
        <img
          src={custom}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      className="grid size-16 place-items-center rounded-full text-3xl"
      style={{
        backgroundImage: `linear-gradient(150deg, ${avatar.gradient[0]}, ${avatar.gradient[1]})`,
      }}
    >
      {avatar.emoji}
    </span>
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
    <div className="mt-6">
      {label ? (
        <div className="text-muted-foreground/70 mb-2.5 px-1 text-xs font-extrabold tracking-wider">
          {label}
        </div>
      ) : null}
      <div className="bg-card divide-border border-border divide-y overflow-hidden rounded-3xl border shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
    >
      {icon ? (
        <span className="bg-muted text-muted-foreground grid size-10 flex-none place-items-center rounded-xl">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 text-sm font-bold">{label}</span>
      {value ? (
        <span className="text-muted-foreground max-w-[55%] truncate text-sm font-semibold">
          {value}
        </span>
      ) : null}
      <ChevronRight className="text-muted-foreground/50 size-4 flex-none" />
    </button>
  );
}
