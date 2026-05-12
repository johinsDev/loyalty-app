import { Tabs, TabsContent, TabsList, TabsTrigger } from "@loyalty/ui";

const meta = { title: "Components/Tabs", component: Tabs, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Tabs defaultValue="account" className="w-80">
      <TabsList><TabsTrigger value="account">Cuenta</TabsTrigger><TabsTrigger value="security">Seguridad</TabsTrigger></TabsList>
      <TabsContent value="account">Cuenta panel</TabsContent>
      <TabsContent value="security">Seguridad panel</TabsContent>
    </Tabs>
  ),
};
