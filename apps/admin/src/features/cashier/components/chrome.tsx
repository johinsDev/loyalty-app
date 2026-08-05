"use client";

import { cn, Skeleton } from "@loyalty/ui";
import { Search } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

/**
 * The register's shared vocabulary.
 *
 * Every tab used to re-declare its own container, section label, chip, badge
 * and empty state, so the five tabs drifted into five looks: the catalog's
 * category chip was `h-9 px-4` while the register's was `h-8 px-3.5`, "no
 * results" was a bare `<p>` on two tabs and a proper empty state on a third,
 * and four incompatible components were all called `Section`. The pieces here
 * are the one answer, taken from the register (the surface redesigned last and
 * the one the cashier spends the shift in) so the rest align to it rather than
 * to each other.
 */

/**
 * The touch scale. The register is the documented exception to admin's 40px
 * controls (see `.claude/skills/admin-ui/SKILL.md`) because it's used on a
 * tablet at arm's length — but the code had drifted to seven heights with no
 * rule, and the documented h-14 was only ever reached by the profile modals.
 */
export const CASHIER = {
  /** The one action a screen exists for: Cobrar, Agregar, Buscar socio. */
  action: "h-14",
  /** Inputs, rows, secondary buttons. */
  control: "h-12",
  /** Chips, filters, anything in a rail. */
  chip: "h-10",
} as const;

/** Panel and card surfaces, so a tab can't invent a third radius. */
export const SURFACE = {
  panel: "bg-card border-border rounded-3xl border p-4 shadow-sm",
  card: "bg-card border-border rounded-2xl border p-3.5 shadow-sm",
} as const;

/**
 * The single small-caps label. Replaces the text-[0.5625rem] / [0.625rem] /
 * [10px] / text-xs variants that all meant "small label". `LABEL_BASE` is the
 * same type without the colour, for the few labels that carry a tone.
 */
export const LABEL_BASE = "text-[0.6875rem] font-extrabold tracking-wider uppercase";
export const LABEL = `text-muted-foreground/70 ${LABEL_BASE}`;

/* ------------------------------------------------------------------ page -- */

/**
 * The page container. `max-w-2xl lg:max-w-4xl` is the width three tabs already
 * agreed on by copy-paste; `narrow` is for the identify screen, which is a
 * single centered card rather than a list and reads badly stretched.
 */
export function CashierPage({
  title,
  subtitle,
  action,
  narrow,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 py-5",
        narrow ? "max-w-md" : "max-w-2xl lg:max-w-4xl",
      )}
    >
      {title ? (
        <div
          className={cn(
            "mb-4 flex items-start gap-3",
            narrow && "flex-col items-center text-center",
          )}
        >
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-muted-foreground mt-1 text-sm font-semibold">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** The register's panel — a titled surface that groups one concern. */
export function CashierPanel({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(SURFACE.panel, className)}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** A labelled group inside a page or panel. */
export function CashierSection({
  icon,
  label,
  action,
  className,
  children,
}: {
  icon?: ReactNode;
  label: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mt-6", className)}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className={cn(LABEL, "flex items-center gap-1.5")}>
          {icon}
          {label}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- row -- */

/**
 * The list row: media, a name, one line of supporting text, badges, and
 * whatever sits on the right. Products, promos, rewards and shift purchases are
 * all this shape — they just weren't written as one, so each list had its own
 * padding and truncation rules.
 */
export function CashierRow({
  media,
  title,
  meta,
  badges,
  trailing,
  onClick,
  style,
  className,
}: {
  media?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  const body = (
    <>
      {media}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{title}</div>
        {meta ? (
          <div className="text-muted-foreground/70 truncate text-xs font-semibold">
            {meta}
          </div>
        ) : null}
        {badges ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">{badges}</div>
        ) : null}
      </div>
      {trailing}
    </>
  );

  const shared = cn(
    SURFACE.card,
    "flex w-full items-center gap-3 text-left",
    className,
  );

  if (!onClick) {
    return (
      <div className={shared} style={style}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        shared,
        "hover:border-primary/40 transition-colors active:scale-[0.99]",
      )}
    >
      {body}
    </button>
  );
}

/** The square media slot on a row — an image when there is one, an icon when not. */
export function CashierMedia({
  url,
  icon,
  large,
  background,
}: {
  url?: string | null;
  icon?: ReactNode;
  large?: boolean;
  /** A promo carries its own `backgroundCss`; using it beats a grey square. */
  background?: string | null;
}) {
  const size = large ? "size-16 rounded-2xl" : "size-11 rounded-xl";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={cn("bg-muted flex-none object-cover", size)} />
    );
  }
  return (
    <span
      className={cn(
        "grid flex-none place-items-center",
        background ? "text-white" : "bg-muted text-muted-foreground",
        size,
      )}
      style={background ? { background } : undefined}
    >
      {icon}
    </span>
  );
}

/* ---------------------------------------------------------------- inputs -- */

export function CashierChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        CASHIER.chip,
        "flex-none rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card text-muted-foreground border-border",
      )}
    >
      {children}
    </button>
  );
}

export function CashierSearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div
      className={cn(
        CASHIER.control,
        "border-border bg-card flex items-center gap-2 rounded-2xl border px-4",
      )}
    >
      <Search className="text-muted-foreground/70 size-5 flex-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm font-semibold outline-none"
      />
    </div>
  );
}

/* ---------------------------------------------------------------- badges -- */

type BadgeTone = "neutral" | "primary" | "warning";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

/**
 * One badge for what used to be four (`EarnBadge`, `ScopeBadge`, `StateBadge`,
 * `StoreBadge`) — the same store-scope fact was drawn two different sizes
 * depending on which tab you were looking at.
 */
export function CashierBadge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-extrabold",
        BADGE_TONE[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------- empty / loading -- */

export function CashierEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="bg-muted text-muted-foreground/50 grid size-14 place-items-center rounded-2xl">
        {icon}
      </span>
      <div>
        <p className="text-foreground text-sm font-bold">{title}</p>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm font-semibold">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Loading looks like the list that's coming, not like the words "Buscando…" —
 * which is what three of the tabs rendered, so a slow catalog and an empty one
 * were the same screen.
 */
export function CashierListSkeleton({
  count = 6,
  grid,
}: {
  count?: number;
  grid?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-4",
        grid ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2.5",
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[4.75rem] w-full rounded-2xl" />
      ))}
    </div>
  );
}
