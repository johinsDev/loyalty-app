"use client";

import {
  AddressAutocomplete,
  Input,
  Label,
  Switch,
  TimeInput,
} from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { type DayHours, DAYS, hours, location } from "../data";

/**
 * Opening hours + store location. Design-first: state is local; seam is a
 * future `settings.hours` mutation backed by an org settings table.
 */
export function HoursSection() {
  const t = useTranslations("Settings");
  const [days, setDays] = useState<DayHours[]>(hours);
  const [address, setAddress] = useState(location.address);
  const [city, setCity] = useState(location.city);
  const [mapsUrl, setMapsUrl] = useState(location.mapsUrl);

  const update = (day: string, patch: Partial<DayHours>) =>
    setDays((prev) =>
      prev.map((d) => (d.day === day ? { ...d, ...patch } : d)),
    );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("hours.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("hours.desc")}</p>
      </div>

      <div className="space-y-2">
        {DAYS.map((dayKey) => {
          const d = days.find((x) => x.day === dayKey)!;
          return (
            <div
              key={dayKey}
              className="border-border flex items-center gap-3 rounded-2xl border p-3"
            >
              <Switch
                checked={!d.closed}
                onCheckedChange={(open) => update(dayKey, { closed: !open })}
              />
              <span className="w-20 flex-none text-sm font-semibold">
                {t(`hours.day.${dayKey}`)}
              </span>
              {d.closed ? (
                <span className="text-muted-foreground text-sm font-semibold">
                  {t("hours.closed")}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <TimeInput
                    value={d.open}
                    onChange={(open) => update(dayKey, { open })}
                    disabled={d.closed}
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <TimeInput
                    value={d.close}
                    onChange={(close) => update(dayKey, { close })}
                    disabled={d.closed}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-border space-y-4 border-t pt-4">
        <h3 className="font-display text-base font-semibold tracking-tight">
          {t("hours.locationTitle")}
        </h3>
        <Field label={t("hours.address")}>
          <AddressAutocomplete
            value={address}
            onValueChange={setAddress}
            placeholder={t("hours.addressPlaceholder")}
          />
        </Field>
        <Field label={t("hours.city")}>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("hours.cityPlaceholder")}
            className="h-10"
          />
        </Field>
        <Field label={t("hours.maps")}>
          <Input
            type="url"
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            placeholder="https://maps.google.com/?q=..."
            className="h-10"
          />
        </Field>
      </div>
    </section>
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
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
