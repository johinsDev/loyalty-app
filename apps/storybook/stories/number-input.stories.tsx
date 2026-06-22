import { CurrencyInput, Label, NumberInput } from "@loyalty/ui";
import { useState } from "react";

const meta = {
  title: "Components/NumberInput",
  component: NumberInput,
  tags: ["autodocs"],
};
export default meta;

/** Digits only, grouped thousands, no spinner. Emits a real `number`. */
export const Default = {
  render: () => {
    const [value, setValue] = useState<number | undefined>(1840);
    return (
      <div className="flex w-72 flex-col gap-1.5">
        <Label htmlFor="points">Puntos</Label>
        <NumberInput id="points" value={value} onValueChange={setValue} />
        <p className="text-muted-foreground text-xs">
          value: {value === undefined ? "—" : value}
        </p>
      </div>
    );
  },
};

/** Admin density: pass `className="h-10"` (overrides the h-14 default). */
export const Admin = {
  render: () => {
    const [value, setValue] = useState<number | undefined>(12);
    return (
      <div className="flex w-72 flex-col gap-1.5">
        <Label htmlFor="stamps">Sellos iniciales</Label>
        <NumberInput
          id="stamps"
          value={value}
          onValueChange={setValue}
          className="h-10"
          placeholder="0"
        />
      </div>
    );
  },
};

/** Prices in different currencies — the symbol is derived from `currency`. */
export const Currency = {
  render: () => {
    const [usd, setUsd] = useState<number | undefined>(6.5);
    const [eur, setEur] = useState<number | undefined>(5.9);
    const [cop, setCop] = useState<number | undefined>(24000);
    return (
      <div className="flex w-72 flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>USD</Label>
          <CurrencyInput currency="USD" value={usd} onValueChange={setUsd} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>EUR</Label>
          <CurrencyInput
            currency="EUR"
            locale="es-ES"
            value={eur}
            onValueChange={setEur}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>COP (whole units)</Label>
          <CurrencyInput
            currency="COP"
            value={cop}
            onValueChange={setCop}
            decimalScale={0}
          />
        </div>
      </div>
    );
  },
};
