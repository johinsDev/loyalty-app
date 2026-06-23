import { IconPicker } from "@loyalty/ui/components/ui/icon-picker";
import { useState } from "react";

const meta = {
  title: "Components/IconPicker",
  component: IconPicker,
  tags: ["autodocs"],
};
export default meta;

export const Default = {
  render: () => {
    const [icon, setIcon] = useState("🎁");
    return (
      <div className="w-80 space-y-4">
        <IconPicker value={icon} onValueChange={setIcon} customLabel="Custom" />
        <div className="text-4xl">{icon}</div>
      </div>
    );
  },
};
