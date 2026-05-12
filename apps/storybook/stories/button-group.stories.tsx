import { Button, ButtonGroup } from "@loyalty/ui";

const meta = { title: "Components/ButtonGroup", component: ButtonGroup, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <ButtonGroup><Button variant="outline">Left</Button><Button variant="outline">Middle</Button><Button variant="outline">Right</Button></ButtonGroup>
  ),
};
