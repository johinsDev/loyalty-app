import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@loyalty/ui";

const meta = { title: "Components/Resizable", tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <ResizablePanelGroup className="h-48 w-96 rounded-md border">
      <ResizablePanel defaultSize={50}><div className="flex h-full items-center justify-center p-4">One</div></ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50}><div className="flex h-full items-center justify-center p-4">Two</div></ResizablePanel>
    </ResizablePanelGroup>
  ),
};
