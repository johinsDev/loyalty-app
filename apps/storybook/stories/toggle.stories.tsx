import { Toggle } from "@loyalty/ui";
import { Bold } from "lucide-react";

const meta = { title: "Components/Toggle", component: Toggle, tags: ["autodocs"] };
export default meta;

export const Default = { render: () => <Toggle aria-label="Toggle bold"><Bold className="size-4" /></Toggle> };
