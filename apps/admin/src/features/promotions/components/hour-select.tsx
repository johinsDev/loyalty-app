"use client";

import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea } from "@loyalty/ui";
import { Clock } from "lucide-react";

/**
 * Non-native time picker (openstatus-style): a trigger showing `HH:mm` opens a
 * popover with two scrollable columns (hours 00–23, minutes in 5-min steps).
 * Emits a 24-hour `"HH:mm"` string — same shape the promo conditions expect.
 */
export function HourSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [h = "", m = ""] = value ? value.split(":") : ["", ""];
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  const pickHour = (hh: string) => onChange(`${hh}:${m || "00"}`);
  const pickMinute = (mm: string) => onChange(`${h || "00"}:${mm}`);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-10 w-full justify-start gap-2 rounded-xl font-normal" />
        }
      >
        <Clock className="text-muted-foreground size-4" />
        {value ? (
          <span>{value}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder ?? "--:--"}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex divide-x">
          <Column items={hours} active={h} onPick={pickHour} />
          <Column items={minutes} active={m} onPick={pickMinute} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Column({
  items,
  active,
  onPick,
}: {
  items: string[];
  active: string;
  onPick: (v: string) => void;
}) {
  return (
    <ScrollArea className="h-56 w-16">
      <div className="flex flex-col p-1">
        {items.map((it) => (
          <button
            key={it}
            type="button"
            onClick={() => onPick(it)}
            className={
              it === active
                ? "bg-primary text-primary-foreground rounded-lg py-1.5 text-sm font-bold"
                : "hover:bg-muted rounded-lg py-1.5 text-sm font-semibold"
            }
          >
            {it}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
