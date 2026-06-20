"use client";

import { authClient } from "@loyalty/auth/client";
import {
  DateWheelPicker,
  type DateValue,
  Input,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Cake, KeyRound, LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "@/i18n/navigation";

import { cashier } from "../data";

/**
 * Perfil tab — the cashier configures their own account (name, nickname,
 * birthday) and preferences (language, theme), changes the shift PIN and signs
 * out. Theme + language live here now (not floating in the corner).
 * Design-first: edits are local until the cashier-account backend lands.
 */
export function ProfileView() {
  const t = useTranslations("Cashier");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState(cashier.name);
  const [nick, setNick] = useState("lulifer");
  const [birthday, setBirthday] = useState<DateValue>({
    day: 9,
    month: 7,
    year: 1998,
  });
  const [bdayOpen, setBdayOpen] = useState(false);
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

  const onSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <div className="mx-auto w-full max-w-md px-5 py-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("tabProfile")}
      </h1>

      {/* Header card */}
      <div className="bg-primary/10 mt-4 flex items-center gap-4 rounded-3xl p-5">
        <span className="bg-primary text-primary-foreground font-display grid size-16 flex-none place-items-center rounded-full text-xl font-semibold">
          {cashier.initials}
        </span>
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold">{name}</div>
          <div className="text-muted-foreground text-sm font-semibold">
            @{nick}
          </div>
        </div>
      </div>

      {/* Account */}
      <Section label={t("profileAccount")}>
        <Field label={t("name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("nickname")}>
          <Input value={nick} onChange={(e) => setNick(e.target.value)} />
        </Field>
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
            /* seam: opens the shift-PIN keypad once the shift model lands */
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

      {/* Birthday picker */}
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
    <div className="mt-6">
      {label ? (
        <div className="text-muted-foreground/70 mb-2.5 px-1 text-xs font-extrabold tracking-wider">
          {label}
        </div>
      ) : null}
      <div className="bg-card divide-border divide-y overflow-hidden rounded-3xl border-border border shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <span className="text-muted-foreground/70 text-xs font-bold">
        {label}
      </span>
      {children}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
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
      <span className="bg-muted text-muted-foreground grid size-10 flex-none place-items-center rounded-xl">
        {icon}
      </span>
      <span className="flex-1 text-sm font-bold">{label}</span>
      {value ? (
        <span className="text-muted-foreground text-sm font-semibold">
          {value}
        </span>
      ) : null}
    </button>
  );
}
