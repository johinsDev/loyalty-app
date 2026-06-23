import { Label } from "@loyalty/ui";
import { NumberStepper } from "@loyalty/ui/components/ui/number-stepper";
import { useState } from "react";

const meta = {
  title: "Components/NumberStepper",
  component: NumberStepper,
  tags: ["autodocs"],
};
export default meta;

/** Minus/plus buttons around a centered number field. */
export const Default = {
  render: () => {
    const [value, setValue] = useState<number | undefined>(3);
    return (
      <div className="flex w-72 flex-col gap-1.5">
        <Label htmlFor="quantity">Cantidad</Label>
        <NumberStepper value={value} onValueChange={setValue} />
        <p className="text-muted-foreground text-xs">
          value: {value === undefined ? "—" : value}
        </p>
      </div>
    );
  },
};

/** Clamped to a range — buttons disable at the bounds. */
export const Bounded = {
  render: () => {
    const [value, setValue] = useState<number | undefined>(2);
    return (
      <div className="flex w-72 flex-col gap-1.5">
        <Label>Sellos (0–10, paso 2)</Label>
        <NumberStepper
          value={value}
          onValueChange={setValue}
          step={2}
          min={0}
          max={10}
        />
        <p className="text-muted-foreground text-xs">
          value: {value === undefined ? "—" : value}
        </p>
      </div>
    );
  },
};
