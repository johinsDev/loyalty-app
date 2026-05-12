import { InputGroup, InputGroupAddon, InputGroupInput } from "@loyalty/ui";

const meta = { title: "Components/InputGroup", component: InputGroup, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <InputGroup className="w-72">
      <InputGroupAddon>https://</InputGroupAddon>
      <InputGroupInput placeholder="example.com" />
    </InputGroup>
  ),
};
