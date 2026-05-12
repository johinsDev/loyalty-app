import { AspectRatio } from "@loyalty/ui";

const meta = { title: "Components/AspectRatio", component: AspectRatio, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <div className="w-80"><AspectRatio ratio={16 / 9} className="bg-muted rounded-md" /></div>
  ),
};
