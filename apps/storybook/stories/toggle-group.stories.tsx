import { ToggleGroup, ToggleGroupItem } from "@loyalty/ui";
import { Bold, Italic, Underline } from "lucide-react";

const meta = { title: "Components/ToggleGroup", component: ToggleGroup, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <ToggleGroup>
      <ToggleGroupItem value="bold"><Bold className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="italic"><Italic className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="underline"><Underline className="size-4" /></ToggleGroupItem>
    </ToggleGroup>
  ),
};
