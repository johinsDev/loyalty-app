import { ScrollArea } from "@loyalty/ui";

const meta = { title: "Components/ScrollArea", component: ScrollArea, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <ScrollArea className="h-48 w-72 rounded-md border p-4 text-sm">
      {Array.from({ length: 30 }, (_, i) => <p key={i}>Line {i + 1}</p>)}
    </ScrollArea>
  ),
};
