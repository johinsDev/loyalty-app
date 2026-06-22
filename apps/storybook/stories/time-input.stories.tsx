import { Label } from "@loyalty/ui";
import { TimeInput } from "@loyalty/ui/components/ui/time-input";
import { useState } from "react";

const meta = {
  title: "Components/TimeInput",
  component: TimeInput,
  tags: ["autodocs"],
};
export default meta;

/** Native time field with a leading clock icon. Emits `"HH:mm"`. */
export const Default = {
  render: () => {
    const [value, setValue] = useState("09:30");
    return (
      <div className="flex w-72 flex-col gap-1.5">
        <Label htmlFor="opens-at">Hora de apertura</Label>
        <TimeInput id="opens-at" value={value} onChange={setValue} />
        <p className="text-muted-foreground text-xs">value: {value || "—"}</p>
      </div>
    );
  },
};
