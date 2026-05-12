import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@loyalty/ui";

const meta = { title: "Components/Tooltip", component: Tooltip, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <TooltipProvider><Tooltip>
      <TooltipTrigger render={<Button variant="outline">Hover</Button>} />
      <TooltipContent>Helpful hint</TooltipContent>
    </Tooltip></TooltipProvider>
  ),
};
