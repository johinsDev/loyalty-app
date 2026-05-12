import { Checkbox, Label } from "@loyalty/ui";

const meta = { title: "Components/Checkbox", component: Checkbox, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <div className="flex items-center gap-2"><Checkbox id="terms" /><Label htmlFor="terms">Acepto los términos</Label></div>
  ),
};
