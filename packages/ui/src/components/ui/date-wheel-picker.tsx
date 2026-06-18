"use client";

import { useEffect, useRef } from "react";

import { cn } from "../../cn";

export type DateValue = { day: number; month: number; year: number };

export type DateWheelPickerProps = {
  /** Selected date. `month` is 1-12. */
  value: DateValue;
  onValueChange: (value: DateValue) => void;
  /** 12 localized month names (index 0 = January). */
  monthLabels: string[];
  minYear?: number;
  maxYear?: number;
  /** Optional column headings (already localized). */
  dayLabel?: string;
  monthLabel?: string;
  yearLabel?: string;
  className?: string;
};

const ITEM = 44;
/** (wheel height 200 − ITEM) / 2 → centers the selected row under the band. */
const PAD = 78;
const HEIGHT = 200;
const MASK =
  "linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)";

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
/** Re-center a column on `targetIdx` only when it isn't already there. */
function sync(el: HTMLDivElement | null, targetIdx: number): void {
  if (el && Math.round(el.scrollTop / ITEM) !== targetIdx) {
    el.scrollTop = targetIdx * ITEM;
  }
}

/**
 * iOS-style date wheel: three snapping columns (day / month / year) with a
 * highlighted center band and faded edges. No calendar grid — built for
 * birthdays / date-of-birth, where scrolling years is the point and the full
 * calendar's year navigation is overkill. Controlled and i18n-agnostic: pass
 * `monthLabels` + column headings already localized.
 */
function DateWheelPicker({
  value,
  onValueChange,
  monthLabels,
  minYear = 1925,
  maxYear = new Date().getFullYear(),
  dayLabel,
  monthLabel,
  yearLabel,
  className,
}: DateWheelPickerProps) {
  const dayEl = useRef<HTMLDivElement>(null);
  const monthEl = useRef<HTMLDivElement>(null);
  const yearEl = useRef<HTMLDivElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dim = daysInMonth(value.month, value.year);

  // Center each column on the current value (on mount + tap + day clamp).
  // When the user scrolls, the settled position already matches → no re-scroll.
  useEffect(() => {
    if (value.day > dim) {
      onValueChange({ ...value, day: dim });
      return;
    }
    sync(dayEl.current, value.day - 1);
    sync(monthEl.current, value.month - 1);
    sync(yearEl.current, value.year - minYear);
  }, [value, dim, minYear, onValueChange]);

  const onScroll = (col: "day" | "month" | "year", el: HTMLDivElement) => {
    clearTimeout(timers.current[col]);
    timers.current[col] = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM);
      if (col === "day") {
        const day = clamp(idx + 1, 1, dim);
        if (day !== value.day) onValueChange({ ...value, day });
      } else if (col === "month") {
        const month = clamp(idx + 1, 1, 12);
        if (month !== value.month) onValueChange({ ...value, month });
      } else {
        const year = clamp(minYear + idx, minYear, maxYear);
        if (year !== value.year) onValueChange({ ...value, year });
      }
    }, 90);
  };

  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  const hasHeadings = Boolean(dayLabel || monthLabel || yearLabel);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {hasHeadings ? (
        <div className="text-muted-foreground flex gap-2 px-1.5 text-xs font-bold tracking-wider">
          <span style={{ flex: 0.85 }} className="text-center">
            {dayLabel}
          </span>
          <span style={{ flex: 1.25 }} className="text-center">
            {monthLabel}
          </span>
          <span style={{ flex: 1 }} className="text-center">
            {yearLabel}
          </span>
        </div>
      ) : null}

      <div
        className="relative flex gap-2 select-none"
        style={{ height: HEIGHT }}
      >
        <div
          aria-hidden
          className="bg-primary/10 ring-primary/25 pointer-events-none absolute inset-x-0 rounded-xl ring-1"
          style={{ top: PAD, height: ITEM }}
        />
        <Wheel refEl={dayEl} flex={0.85} onScroll={(el) => onScroll("day", el)}>
          {Array.from({ length: dim }, (_, i) => (
            <WheelItem
              key={i + 1}
              active={value.day === i + 1}
              onClick={() => onValueChange({ ...value, day: i + 1 })}
            >
              {i + 1}
            </WheelItem>
          ))}
        </Wheel>
        <Wheel
          refEl={monthEl}
          flex={1.25}
          onScroll={(el) => onScroll("month", el)}
        >
          {monthLabels.map((label, i) => (
            <WheelItem
              key={label}
              active={value.month === i + 1}
              onClick={() => onValueChange({ ...value, month: i + 1 })}
            >
              {label}
            </WheelItem>
          ))}
        </Wheel>
        <Wheel refEl={yearEl} flex={1} onScroll={(el) => onScroll("year", el)}>
          {years.map((y) => (
            <WheelItem
              key={y}
              active={value.year === y}
              onClick={() => onValueChange({ ...value, year: y })}
            >
              {y}
            </WheelItem>
          ))}
        </Wheel>
      </div>
    </div>
  );
}

function Wheel({
  refEl,
  flex,
  onScroll,
  children,
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  flex: number;
  onScroll: (el: HTMLDivElement) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={refEl}
      onScroll={(event) => onScroll(event.currentTarget)}
      className="snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        flex,
        paddingBlock: PAD,
        maskImage: MASK,
        WebkitMaskImage: MASK,
      }}
    >
      {children}
    </div>
  );
}

function WheelItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={cn(
        "flex w-full snap-center snap-always items-center justify-center whitespace-nowrap transition-all",
        active
          ? "text-primary text-xl font-extrabold"
          : "text-muted-foreground/70 text-lg font-medium",
      )}
      style={{ height: ITEM }}
    >
      {children}
    </button>
  );
}

export { DateWheelPicker };
