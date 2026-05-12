import { Avatar, AvatarFallback, Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@loyalty/ui";

const meta = { title: "Components/Item", component: Item, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Item className="w-80">
      <ItemMedia><Avatar><AvatarFallback>JV</AvatarFallback></Avatar></ItemMedia>
      <ItemContent><ItemTitle>Johan Villamil</ItemTitle><ItemDescription>founder</ItemDescription></ItemContent>
    </Item>
  ),
};
