"use client";

import { authClient } from "@loyalty/auth/client";
import { Button, cn, Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "@/i18n/nav";
import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { CASHIER, CashierPage, CashierPanel } from "./chrome";

/**
 * Perfil tab — who is signed in at this register, the two preferences that are
 * really theirs (language, theme), and the way out.
 *
 * It used to be a design mock: name, nickname, birthday and a tea-avatar picker
 * driven by `useState` seeded from a hardcoded "Lucía Fernández", with three
 * modals that edited values nothing ever saved. Reloading the tab reverted
 * everything, and every cashier in every shop saw the same invented person.
 * There is no self-service employee endpoint to hang it on either —
 * `employees.update` is owner-only — so the screen now shows the real session
 * and says plainly who does own the account.
 */
export function ProfileView() {
  const t = useTranslations("Cashier");
  // The role labels already exist for the team screens; a second set under
  // Cashier would be the same three words maintained twice.
  const tRole = useTranslations("Employees");
  const fade = useFadeUp();
  const router = useRouter();
  const trpc = useTRPC();
  const [signingOut, setSigningOut] = useState(false);

  const { data: session } = authClient.useSession();
  const { data: stores } = useQuery(trpc.employees.myStores.queryOptions());

  // `useSession` reads Better Auth's client store, which is already populated on
  // the very first client render but empty during SSR — so the identity rendered
  // "—" on the server and "PA / Preview Admin" on the client, and React threw a
  // hydration mismatch. Holding the block until mount makes the two agree; the
  // session lands a tick later either way.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The role comes from `auth.me`, not `useRole()`: the cashier shell's RoleGate
  // covers the header only, and widening it to wrap the page took every cashier
  // route down (see the layout's note). Better Auth's `getActiveMember()` is no
  // use here either — an operator session carries no active organization, so it
  // answers NO_ACTIVE_ORGANIZATION. `auth.me` is the same lookup the shell does,
  // already role-cached server-side.
  const { data: me } = useQuery(trpc.auth.me.queryOptions());
  const role = me?.role ?? null;

  const user = mounted ? session?.user : undefined;
  const name = user?.name?.trim() || user?.email || null;
  const storeNames = (stores ?? []).map((s) => s.name);

  const onSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <CashierPage title={t("tabProfile")}>
      <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
        <CashierPanel title={t("profileAccount")} className="min-w-0" >
          <div style={fade(0)} className="flex items-center gap-3.5">
            {name === null ? (
              <>
                <Skeleton className="size-14 flex-none rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </>
            ) : (
              <>
                <span className="bg-primary/10 text-primary font-display grid size-14 flex-none place-items-center rounded-2xl text-lg font-semibold">
                  {initials(name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-base font-extrabold">{name}</div>
                  {user?.email ? (
                    <div className="text-muted-foreground truncate text-sm font-semibold">
                      {user.email}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <dl className="divide-border mt-4 divide-y border-t pt-1">
            <InfoRow label={t("profileRole")} value={role ? tRole(`role.${role}`) : "—"} />
            <InfoRow
              label={t("profileStores")}
              value={storeNames.length > 0 ? storeNames.join(" · ") : t("profileAllStores")}
              icon={<Store className="size-3.5" />}
            />
          </dl>

          {/* Not shown to the owner — they ARE who administers it. */}
          {role !== null && role !== "owner" ? (
            <p className="text-muted-foreground/70 mt-3 text-xs font-semibold">
              {t("profileReadOnly")}
            </p>
          ) : null}
        </CashierPanel>

        <div className="flex min-w-0 flex-col gap-5">
          <CashierPanel title={t("preferences")}>
            <div className="divide-border divide-y">
              <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <span className="text-sm font-bold">{t("language")}</span>
                <LocaleSwitcher />
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-bold">{t("theme")}</span>
                <ThemeToggle />
              </div>
            </div>
          </CashierPanel>

          <CashierPanel title={t("profileSession")}>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onSignOut()}
              disabled={signingOut}
              className={cn(
                CASHIER.control,
                // `text-destructive`, not the hand-picked rose this screen used
                // to carry — the token is what the rest of admin destroys with.
                "text-destructive hover:text-destructive w-full justify-start gap-3 rounded-2xl font-bold",
              )}
            >
              <LogOut className="size-5" />
              {signingOut ? t("signingOut") : t("signOut")}
            </Button>
          </CashierPanel>
        </div>
      </div>
    </CashierPage>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {label}
      </dt>
      <dd className="max-w-[60%] truncate text-sm font-bold">{value}</dd>
    </div>
  );
}

/** "Lucía Fernández" → "LF". */
function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
