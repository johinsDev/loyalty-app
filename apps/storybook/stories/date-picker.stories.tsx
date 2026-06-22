import { DatePicker, Label } from "@loyalty/ui";
import { useState } from "react";

const meta = {
  title: "Components/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
};
export default meta;

/** Button trigger + Calendar in a Popover. Use for calendar dates (scheduling). */
export const Default = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(undefined);
    return (
      <div className="flex w-72 flex-col gap-1.5">
        <Label>Fecha de envío</Label>
        <DatePicker
          value={date}
          onValueChange={setDate}
          formatLabel={(d) => d.toLocaleDateString("es-CO", { dateStyle: "medium" })}
        />
        <p className="text-muted-foreground text-xs">
          value: {date ? date.toISOString().slice(0, 10) : "—"}
        </p>
      </div>
    );
  },
};
