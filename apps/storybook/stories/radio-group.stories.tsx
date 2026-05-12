import { Label, RadioGroup, RadioGroupItem } from "@loyalty/ui";

const meta = { title: "Components/RadioGroup", component: RadioGroup, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <RadioGroup defaultValue="matcha">
      <div className="flex items-center gap-2"><RadioGroupItem value="matcha" id="r1" /><Label htmlFor="r1">Matcha</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="sencha" id="r2" /><Label htmlFor="r2">Sencha</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="hojicha" id="r3" /><Label htmlFor="r3">Hojicha</Label></div>
    </RadioGroup>
  ),
};
