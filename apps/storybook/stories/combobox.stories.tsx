import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxGroup, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList, ComboboxTrigger } from "@loyalty/ui";

const meta = { title: "Components/Combobox", component: Combobox, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <Combobox>
      <ComboboxTrigger />
      <ComboboxContent>
        <ComboboxInput placeholder="Search…" />
        <ComboboxList>
          <ComboboxEmpty>Nothing found.</ComboboxEmpty>
          <ComboboxGroup>
            <ComboboxLabel>Frameworks</ComboboxLabel>
            <ComboboxItem value="next">Next.js</ComboboxItem>
            <ComboboxItem value="remix">Remix</ComboboxItem>
            <ComboboxItem value="astro">Astro</ComboboxItem>
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};
