import { Label, Switch } from "@loyalty/ui";

const meta = { title: "Components/Switch", component: Switch, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <div className="flex items-center gap-2"><Switch id="airplane" /><Label htmlFor="airplane">Airplane mode</Label></div>
  ),
};
