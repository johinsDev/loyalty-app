import { InputPhone, Label } from "@loyalty/ui";
import { useState } from "react";

const meta = {
  title: "Components/InputPhone",
  component: InputPhone,
  tags: ["autodocs"],
};
export default meta;

export const Default = {
  render: () => {
    const [value, setValue] = useState<string>();
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label>Teléfono</Label>
        <InputPhone
          defaultCountry="CO"
          value={value}
          onChange={setValue}
          placeholder="300 000 0000"
        />
        <span className="text-muted-foreground text-xs">E.164: {value ?? "—"}</span>
      </div>
    );
  },
};

export const Prefilled = {
  render: () => {
    const [value, setValue] = useState<string | undefined>("+573005550000");
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label>Teléfono</Label>
        <InputPhone defaultCountry="CO" value={value} onChange={setValue} />
      </div>
    );
  },
};

export const WithError = {
  render: () => {
    const [value, setValue] = useState<string>();
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label>Teléfono</Label>
        <InputPhone
          value={value}
          onChange={setValue}
          placeholder="300 000 0000"
          aria-invalid="true"
        />
        <span className="text-destructive text-xs">Número inválido</span>
      </div>
    );
  },
};
