import { Avatar, AvatarFallback, AvatarImage, Button, HoverCard, HoverCardContent, HoverCardTrigger } from "@loyalty/ui";

const meta = { title: "Components/HoverCard", component: HoverCard, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger render={<Button variant="link">@johin</Button>} />
      <HoverCardContent className="w-72">
        <div className="flex gap-3"><Avatar><AvatarImage src="https://github.com/shadcn.png" /><AvatarFallback>JV</AvatarFallback></Avatar>
          <div><h4 className="text-sm font-semibold">@johin</h4><p className="text-sm">Founder, building Loyalty.</p></div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};
