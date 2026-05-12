import { Button, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@loyalty/ui";
import { Inbox } from "lucide-react";

const meta = { title: "Components/Empty", component: Empty, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Empty className="w-80">
      <EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>No messages</EmptyTitle><EmptyDescription>You are all caught up.</EmptyDescription></EmptyHeader>
      <EmptyContent><Button variant="outline">Refresh</Button></EmptyContent>
    </Empty>
  ),
};
