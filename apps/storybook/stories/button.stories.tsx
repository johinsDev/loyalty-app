import { Button } from "@loyalty/ui";
import { Mail } from "lucide-react";

const meta = { title: "Components/Button", component: Button, tags: ["autodocs"] };
export default meta;

export const Default = { render: () => <Button>Button</Button> };
export const Outline = { render: () => <Button variant="outline">Outline</Button> };
export const Secondary = { render: () => <Button variant="secondary">Secondary</Button> };
export const Ghost = { render: () => <Button variant="ghost">Ghost</Button> };
export const Destructive = { render: () => <Button variant="destructive">Destructive</Button> };
export const LinkVariant = { name: "Link", render: () => <Button variant="link">Link</Button> };
export const Sm = { render: () => <Button size="sm">Small</Button> };
export const Lg = { render: () => <Button size="lg">Large</Button> };
export const Icon = { render: () => <Button size="icon"><Mail /></Button> };
export const Disabled = { render: () => <Button disabled>Disabled</Button> };
