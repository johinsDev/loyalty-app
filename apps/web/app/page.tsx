import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Tu tarjeta de fidelización</CardTitle>
          <CardDescription>Acumula sellos en cada compra y reclama tus premios.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/tarjeta">
            <Button className="w-full">Ver mi tarjeta</Button>
          </Link>
          <Link href="/perfil">
            <Button variant="outline" className="w-full">
              Mi perfil
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
