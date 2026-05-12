import { Button, Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@loyalty/ui";

const meta = { title: "Components/Card", component: Card, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Card className="w-80">
      <CardHeader><CardTitle>Tu tarjeta</CardTitle><CardDescription>3 sellos hasta tu próximo premio.</CardDescription></CardHeader>
      <CardContent>Acumulá uno con cada compra.</CardContent>
      <CardFooter><Button>Ver detalle</Button></CardFooter>
    </Card>
  ),
};
export const WithAction = {
  render: () => (
    <Card className="w-80">
      <CardHeader><CardTitle>Sesión</CardTitle><CardDescription>Cerrar tu sesión</CardDescription><CardAction><Button variant="outline" size="sm">Logout</Button></CardAction></CardHeader>
    </Card>
  ),
};
