"use client";

import { cn } from "../../cn";

export type MonthDayValue = { month: number; day: number };

export type MonthDayPickerProps = {
  /** Selected month (1-12) and day (1-31). */
  value: MonthDayValue;
  onValueChange: (value: MonthDayValue) => void;
  /** 12 localized short month labels (Ene…Dic / Jan…Dec). */
  monthLabels: string[];
  /** Days to show; defaults to 31. */
  days?: number;
  /** Optional section headings (already localized). */
  monthLabel?: string;
  dayLabel?: string;
  className?: string;
};

/**
 * Compact birthday-style date picker: a horizontal month chip rail + a day
 * grid, with large mobile tap targets. It has no year — use it for birthdays or
 * any month/day date where the full calendar (and its year navigation) is
 * overkill. Controlled and i18n-agnostic: pass `monthLabels` + headings already
 * localized.
 */
function MonthDayPicker({
  value,
  onValueChange,
  monthLabels,
  days = 31,
  monthLabel,
  dayLabel,
  className,
}: MonthDayPickerProps) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div>
        {monthLabel ? (
          <p className="text-muted-foreground mb-2.5 text-xs font-bold tracking-wider">
            {monthLabel}
          </p>
        ) : null}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {monthLabels.map((label, index) => {
            const month = index + 1;
            const active = value.month === month;
            return (
              <button
                key={month}
                type="button"
                aria-pressed={active}
                onClick={() => onValueChange({ ...value, month })}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {dayLabel ? (
          <p className="text-muted-foreground mb-2.5 text-xs font-bold tracking-wider">
            {dayLabel}
          </p>
        ) : null}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: days }, (_, index) => {
            const day = index + 1;
            const active = value.day === day;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                onClick={() => onValueChange({ ...value, day })}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl border text-sm font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { MonthDayPicker };
