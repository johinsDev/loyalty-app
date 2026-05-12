import { NativeSelect } from "@loyalty/ui";

const meta = { title: "Components/NativeSelect", component: NativeSelect, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <NativeSelect className="w-48">
      <option>Choose a tea</option><option>Matcha</option><option>Sencha</option><option>Hojicha</option>
    </NativeSelect>
  ),
};
