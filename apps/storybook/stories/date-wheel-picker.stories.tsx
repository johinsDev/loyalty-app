import { DateWheelPicker, type DateValue } from "@loyalty/ui";
import { useState } from "react";

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_ES_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const meta = {
  title: "Components/DateWheelPicker",
  component: DateWheelPicker,
  tags: ["autodocs"],
};
export default meta;

function Readout({ value }: { value: DateValue }) {
  return (
    <p className="text-muted-foreground mt-3 text-center text-sm tabular-nums">
      {value.day}/{value.month}/{value.year}
    </p>
  );
}

/** Three momentum drums under one band. Drag, flick, scroll or use the arrow keys. */
export const Default = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 12,
      month: 8,
      year: 2001,
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_ES}
          dayLabel="DÍA"
          monthLabel="MES"
          yearLabel="AÑO"
        />
        <Readout value={value} />
      </div>
    );
  },
};

export const English = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 1,
      month: 3,
      year: 1995,
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_EN}
          dayLabel="DAY"
          monthLabel="MONTH"
          yearLabel="YEAR"
        />
        <Readout value={value} />
      </div>
    );
  },
};

/** Without the three heading props the columns lose their titles — and their accessible names. */
export const NoHeadings = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 28,
      month: 2,
      year: 2000,
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_EN}
          minYear={1990}
          maxYear={2010}
        />
        <Readout value={value} />
      </div>
    );
  },
};

/**
 * The day wheel follows the calendar. February 2000 offers 29 days; scroll the
 * year to 2001 and it drops to 28, pulling the selection back with it.
 */
export const LeapDay = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 29,
      month: 2,
      year: 2000,
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_ES}
          dayLabel="DÍA"
          monthLabel="MES"
          yearLabel="AÑO"
          minYear={1996}
          maxYear={2004}
        />
        <Readout value={value} />
      </div>
    );
  },
};

/**
 * With no `maxYear` / `maxDate` the upper bound is today, so a future birth
 * date cannot be picked at all: scroll the year wheel to the top and the month
 * wheel stops at the current month, and that month at today's day.
 */
export const NoFutureDates = {
  render: () => {
    const now = new Date();
    const [value, setValue] = useState<DateValue>({
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_ES}
          dayLabel="DÍA"
          monthLabel="MES"
          yearLabel="AÑO"
        />
        <Readout value={value} />
      </div>
    );
  },
};

/** An explicit window clamps every wheel at both ends. */
export const BoundedWindow = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 15,
      month: 7,
      year: 2005,
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_ES}
          dayLabel="DÍA"
          monthLabel="MES"
          yearLabel="AÑO"
          minDate={{ day: 10, month: 5, year: 2000 }}
          maxDate={{ day: 3, month: 8, year: 2010 }}
        />
        <Readout value={value} />
      </div>
    );
  },
};

/** `order` re-arranges the columns — month-first for en-US, year-first for ISO-ish input. */
export const MonthFirst = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 4,
      month: 7,
      year: 1990,
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_EN}
          order={["month", "day", "year"]}
          monthLabel="MONTH"
          dayLabel="DAY"
          yearLabel="YEAR"
        />
        <Readout value={value} />
      </div>
    );
  },
};

/** Denser rows for admin surfaces, with short month names. */
export const Compact = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 9,
      month: 7,
      year: 1998,
    });
    return (
      <div className="max-w-xs">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_ES_SHORT}
          dayLabel="DÍA"
          monthLabel="MES"
          yearLabel="AÑO"
          itemHeight={36}
          visibleCount={5}
        />
        <Readout value={value} />
      </div>
    );
  },
};

/** Seven rows through the window flattens the curve of the drum. */
export const TallerWindow = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 21,
      month: 11,
      year: 1987,
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_ES}
          dayLabel="DÍA"
          monthLabel="MES"
          yearLabel="AÑO"
          visibleCount={7}
        />
        <Readout value={value} />
      </div>
    );
  },
};

/** Opt-in Web Audio tick on every row crossed. Off by default. */
export const WithSound = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 3,
      month: 6,
      year: 1992,
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_ES}
          dayLabel="DÍA"
          monthLabel="MES"
          yearLabel="AÑO"
          sound
        />
        <Readout value={value} />
      </div>
    );
  },
};

export const Disabled = {
  render: () => {
    const [value, setValue] = useState<DateValue>({
      day: 12,
      month: 8,
      year: 2001,
    });
    return (
      <div className="max-w-sm">
        <DateWheelPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_ES}
          dayLabel="DÍA"
          monthLabel="MES"
          yearLabel="AÑO"
          disabled
        />
        <Readout value={value} />
      </div>
    );
  },
};
