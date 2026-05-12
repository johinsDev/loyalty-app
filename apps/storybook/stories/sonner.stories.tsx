import { Button, Toaster } from "@loyalty/ui";
import { toast } from "sonner";

const meta = { title: "Components/Sonner (Toast)", tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <>
      <Button variant="outline" onClick={() => toast("Saved", { description: "Your changes were saved." })}>Show toast</Button>
      <Toaster />
    </>
  ),
};
