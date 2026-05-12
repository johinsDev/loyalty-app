import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@loyalty/ui";

const meta = { title: "Components/NavigationMenu", component: NavigationMenu, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <NavigationMenu><NavigationMenuList>
      <NavigationMenuItem><NavigationMenuTrigger>Productos</NavigationMenuTrigger><NavigationMenuContent><NavigationMenuLink href="#">Té</NavigationMenuLink><NavigationMenuLink href="#">Café</NavigationMenuLink></NavigationMenuContent></NavigationMenuItem>
      <NavigationMenuItem><NavigationMenuLink href="#">Contacto</NavigationMenuLink></NavigationMenuItem>
    </NavigationMenuList></NavigationMenu>
  ),
};
