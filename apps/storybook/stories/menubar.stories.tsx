import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "@loyalty/ui";

const meta = { title: "Components/Menubar", component: Menubar, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <Menubar>
      <MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent><MenubarItem>New</MenubarItem><MenubarItem>Open</MenubarItem><MenubarSeparator /><MenubarItem>Quit</MenubarItem></MenubarContent></MenubarMenu>
      <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent><MenubarItem>Undo</MenubarItem><MenubarItem>Redo</MenubarItem></MenubarContent></MenubarMenu>
    </Menubar>
  ),
};
