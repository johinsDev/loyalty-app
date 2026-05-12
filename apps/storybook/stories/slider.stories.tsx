import { Slider } from "@loyalty/ui";

const meta = { title: "Components/Slider", component: Slider, tags: ["autodocs"] };
export default meta;

export const Default = { render: () => <Slider defaultValue={[50]} max={100} step={1} className="w-72" /> };
