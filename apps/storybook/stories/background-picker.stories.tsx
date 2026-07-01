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
        <BackgroundPicker value={bg} onValueChange={setBg} colorLabel="Color" />
        <div className="h-24 rounded-2xl" style={{ background: bg }} />
      </div>
    );
  },
};

export const WithPattern = {
  render: () => {
    const [bg, setBg] = useState(
      "radial-gradient(rgba(255,255,255,0.18) 1.5px, transparent 1.6px) 0 0/14px 14px, linear-gradient(135deg, #1BAD9D, #0e6f64)",
    );
    return (
      <div className="w-80 space-y-4">
        <BackgroundPicker value={bg} onValueChange={setBg} colorLabel="Color" />
        <div className="h-24 rounded-2xl" style={{ background: bg }} />
      </div>
    );
  },
};

export const NoPatterns = {
  render: () => {
    const [bg, setBg] = useState("linear-gradient(135deg, #7c5cff, #4527a0)");
    return (
      <div className="w-80 space-y-4">
        <BackgroundPicker value={bg} onValueChange={setBg} patterns={[]} />
        <div className="h-24 rounded-2xl" style={{ background: bg }} />
      </div>
    );
  },
};
