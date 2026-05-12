import { Button, Input, Label, Popover, PopoverContent, PopoverTrigger } from "@loyalty/ui";

const meta = { title: "Components/Popover", component: Popover, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline">Open</Button>} />
      <PopoverContent className="w-72 grid gap-2"><Label htmlFor="width">Width</Label><Input id="width" defaultValue="100%" /></PopoverContent>
    </Popover>
  ),
};
