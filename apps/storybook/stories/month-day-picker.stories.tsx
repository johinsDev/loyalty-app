import { MonthDayPicker, type MonthDayValue } from "@loyalty/ui";
import { useState } from "react";

const MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const meta = {
  title: "Components/MonthDayPicker",
  component: MonthDayPicker,
  tags: ["autodocs"],
};
export default meta;

export const Default = {
  render: () => {
    const [value, setValue] = useState<MonthDayValue>({ month: 7, day: 14 });
    return (
      <div className="max-w-md">
        <MonthDayPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_ES}
          monthLabel="MES"
          dayLabel="DÍA"
        />
        <p className="text-muted-foreground mt-4 text-sm">
          Seleccionado: {value.day}/{value.month}
        </p>
      </div>
    );
  },
};

export const English = {
  render: () => {
    const [value, setValue] = useState<MonthDayValue>({ month: 3, day: 1 });
    return (
      <div className="max-w-md">
        <MonthDayPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_EN}
          monthLabel="MONTH"
          dayLabel="DAY"
        />
      </div>
    );
  },
};

export const NoHeadings = {
  render: () => {
    const [value, setValue] = useState<MonthDayValue>({ month: 1, day: 1 });
    return (
      <div className="max-w-md">
        <MonthDayPicker
          value={value}
          onValueChange={setValue}
          monthLabels={MONTHS_EN}
        />
      </div>
    );
  },
};
