import { Card, CardContent, CardHeader, CardTitle, ChartContainer, ChartTooltip, ChartTooltipContent } from "@loyalty/ui";
import { Bar, BarChart, XAxis } from "recharts";

const data = [
  { month: "Ene", visits: 186 }, { month: "Feb", visits: 305 }, { month: "Mar", visits: 237 }, { month: "Abr", visits: 273 },
];
const config = { visits: { label: "Visitas", color: "var(--chart-1)" } };

const meta = { title: "Components/Chart", tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Bar_ = {
  name: "Bar",
  render: () => (
    <Card className="w-96"><CardHeader><CardTitle>Visitas / mes</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={config}>
          <BarChart data={data}><XAxis dataKey="month" /><Bar dataKey="visits" fill="var(--chart-1)" radius={4} /><ChartTooltip content={<ChartTooltipContent />} /></BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  ),
};
