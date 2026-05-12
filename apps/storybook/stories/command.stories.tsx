import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@loyalty/ui";
import { Calculator, Calendar, Smile } from "lucide-react";

const meta = { title: "Components/Command", component: Command, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <Command className="w-80 rounded-lg border shadow-md">
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem><Calendar />Calendar</CommandItem>
          <CommandItem><Smile />Emoji</CommandItem>
          <CommandItem><Calculator />Calculator</CommandItem>
        </CommandGroup>
        <CommandSeparator />
      </CommandList>
    </Command>
  ),
};
