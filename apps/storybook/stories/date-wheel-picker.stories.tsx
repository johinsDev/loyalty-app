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

const meta = {
  title: "Components/DateWheelPicker",
  component: DateWheelPicker,
  tags: ["autodocs"],
};
export default meta;

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
        <p className="text-muted-foreground mt-3 text-center text-sm">
          {value.day}/{value.month}/{value.year}
        </p>
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
      </div>
    );
  },
};

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
      </div>
    );
  },
};
