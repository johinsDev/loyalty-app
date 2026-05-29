import { ModeToggle, ThemeProvider } from "@loyalty/ui";

const meta = {
  title: "Components/ModeToggle",
  component: ModeToggle,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};
export default meta;

export const Default = {
  render: () => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ModeToggle />
    </ThemeProvider>
  ),
};
