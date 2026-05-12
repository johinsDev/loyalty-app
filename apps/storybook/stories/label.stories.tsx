import { Input, Label } from "@loyalty/ui";

const meta = { title: "Components/Label", component: Label, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <div className="grid gap-2 w-72"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="me@example.com" /></div>
  ),
};
