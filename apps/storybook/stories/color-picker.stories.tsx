import { ColorPicker } from "@loyalty/ui/components/ui/color-picker";
import { useState } from "react";

const meta = {
  title: "Components/ColorPicker",
  component: ColorPicker,
  tags: ["autodocs"],
};
export default meta;

export const Default = {
  render: () => {
    const [color, setColor] = useState("#1BAD9D");
    return (
      <div className="flex flex-col items-start gap-4">
        <ColorPicker value={color} onValueChange={setColor} />
        <div className="flex items-center gap-2 text-sm">
          <span
            className="size-6 rounded-md ring-1 ring-foreground/10"
            style={{ background: color }}
          />
          <span className="font-mono uppercase">{color}</span>
        </div>
      </div>
    );
  },
};
