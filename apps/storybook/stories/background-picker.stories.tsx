import { BackgroundPicker } from "@loyalty/ui/components/ui/background-picker";
import { useState } from "react";

const meta = {
  title: "Components/BackgroundPicker",
  component: BackgroundPicker,
  tags: ["autodocs"],
};
export default meta;

export const Default = {
  render: () => {
    const [bg, setBg] = useState("linear-gradient(135deg, #1BAD9D, #0e6f64)");
    return (
      <div className="w-80 space-y-4">
        <BackgroundPicker value={bg} onValueChange={setBg} customLabel="Custom" />
        <div className="h-24 rounded-2xl" style={{ background: bg }} />
      </div>
    );
  },
};
