import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string }> };

/**
 * WhatsApp Outbox panel. Lists messages persisted by the `outbox`
 * provider in `@loyalty/whatsapp`. Active in preview deploys
 * (and locally when `WHATSAPP_PROVIDER=outbox`). Empty in production
 * since Twilio is the provider there.
 */
export default async function WhatsAppOutboxPage({ params }: Props) {
  const { locale: _locale } = await params;
  const api = await trpc();
  const { rows } = await api.whatsappOutbox.list({ page: 1, pageSize: 100 });

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">WhatsApp Outbox</h1>
        <p className="text-sm text-muted-foreground">
          Mensajes enviados a través del provider <code>outbox</code> de{" "}
          <code>@loyalty/whatsapp</code>. Vacío en producción.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay mensajes</CardTitle>
            <CardDescription>
              Cuando algún flow dispare un envío a WhatsApp con el provider
              outbox, vas a verlo acá.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              ¿Esperás ver mensajes? Asegurate de que la app esté corriendo con{" "}
              <code>WHATSAPP_PROVIDER=outbox</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuándo</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vista previa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.sentAt.toISOString().replace("T", " ").slice(0, 19)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.to}</TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === "sent" ? "secondary" : "destructive"}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={{
                          pathname: "/whatsapp-outbox/[id]",
                          params: { id: row.id },
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        {row.content.slice(0, 60)}
                        {row.content.length > 60 ? "…" : ""}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
