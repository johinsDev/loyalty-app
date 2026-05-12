import { Input } from "@loyalty/ui";

const meta = { title: "Components/Input", component: Input, tags: ["autodocs"] };
export default meta;

export const Default = { render: () => <Input placeholder="Email" className="w-72" /> };
export const Disabled = { render: () => <Input placeholder="Disabled" disabled className="w-72" /> };
export const File = { render: () => <Input type="file" className="w-72" /> };
