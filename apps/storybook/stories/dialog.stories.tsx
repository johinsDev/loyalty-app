import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label } from "@loyalty/ui";

const meta = { title: "Components/Dialog", component: Dialog, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update your name and save.</DialogDescription></DialogHeader>
        <div className="grid gap-3"><Label htmlFor="name">Name</Label><Input id="name" defaultValue="Johan" /></div>
        <DialogFooter><Button>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
