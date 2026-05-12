import { Skeleton } from "@loyalty/ui";

const meta = { title: "Components/Skeleton", component: Skeleton, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <div className="flex items-center gap-4 w-72"><Skeleton className="size-12 rounded-full" />
      <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-24" /></div>
    </div>
  ),
};
