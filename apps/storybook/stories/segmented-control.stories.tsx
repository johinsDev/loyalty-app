import { SegmentedControl } from "@loyalty/ui";
import { MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";

const meta = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
};
export default meta;

export const Language = {
  render: () => {
    const [value, setValue] = useState<"es" | "en">("es");
    return (
      <SegmentedControl<"es" | "en">
        aria-label="Language"
        value={value}
        onValueChange={setValue}
        options={[
          { value: "es", label: "ES" },
          { value: "en", label: "EN" },
        ]}
      />
    );
  },
};

export const Theme = {
  render: () => {
    const [value, setValue] = useState<"light" | "dark">("light");
    return (
      <SegmentedControl<"light" | "dark">
        aria-label="Theme"
        value={value}
        onValueChange={setValue}
        options={[
          { value: "light", label: "Claro", icon: SunIcon },
          { value: "dark", label: "Oscuro", icon: MoonIcon },
        ]}
      />
    );
  },
};
