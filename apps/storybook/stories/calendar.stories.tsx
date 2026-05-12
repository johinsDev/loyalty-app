import { Calendar } from "@loyalty/ui";

const meta = { title: "Components/Calendar", component: Calendar, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => <Calendar className="rounded-md border" />,
};
