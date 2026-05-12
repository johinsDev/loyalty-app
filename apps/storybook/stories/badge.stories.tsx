import { Badge } from "@loyalty/ui";

const meta = { title: "Components/Badge", component: Badge, tags: ["autodocs"] };
export default meta;

export const Default = { render: () => <Badge>Default</Badge> };
export const Secondary = { render: () => <Badge variant="secondary">Secondary</Badge> };
export const Outline = { render: () => <Badge variant="outline">Outline</Badge> };
export const Destructive = { render: () => <Badge variant="destructive">Destructive</Badge> };
