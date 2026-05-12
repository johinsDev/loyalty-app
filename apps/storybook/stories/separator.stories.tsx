import { Separator } from "@loyalty/ui";

const meta = { title: "Components/Separator", component: Separator, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <div className="w-72"><div className="text-sm">Above</div><Separator className="my-2" /><div className="text-sm">Below</div></div>
  ),
};
