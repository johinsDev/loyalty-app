import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@loyalty/ui";

const meta = { title: "Components/Sidebar", component: Sidebar, tags: ["autodocs"], parameters: { layout: "fullscreen" } };
export default meta;

export const Default = {
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader><div className="px-2 py-1 font-semibold">Loyalty</div></SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Inicio</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem><SidebarMenuButton>Dashboard</SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton>Clientes</SidebarMenuButton></SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 items-center justify-center p-6">Content</main>
    </SidebarProvider>
  ),
};
