import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@loyalty/ui";

const meta = { title: "Components/Sheet", component: Sheet, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open</Button>} />
      <SheetContent>
        <SheetHeader><SheetTitle>Settings</SheetTitle><SheetDescription>Slides in from the side.</SheetDescription></SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
