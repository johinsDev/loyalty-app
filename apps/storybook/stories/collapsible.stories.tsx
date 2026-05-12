import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@loyalty/ui";
import { ChevronsUpDown } from "lucide-react";

const meta = { title: "Components/Collapsible", component: Collapsible, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Collapsible className="w-72 space-y-2">
      <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">@johin</h4><CollapsibleTrigger render={<Button variant="ghost" size="icon"><ChevronsUpDown /></Button>} /></div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-4 py-3 text-sm">@johin/loyalty</div>
        <div className="rounded-md border px-4 py-3 text-sm">@johin/ui</div>
      </CollapsibleContent>
    </Collapsible>
  ),
};
