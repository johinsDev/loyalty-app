import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@loyalty/ui";

const meta = { title: "Components/Select", component: Select, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <Select>
      <SelectTrigger className="w-48"><SelectValue placeholder="Pick a tea" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="matcha">Matcha</SelectItem>
        <SelectItem value="sencha">Sencha</SelectItem>
        <SelectItem value="hojicha">Hojicha</SelectItem>
      </SelectContent>
    </Select>
  ),
};
