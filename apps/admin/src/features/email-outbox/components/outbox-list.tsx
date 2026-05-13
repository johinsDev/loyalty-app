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

/**
 * Email Outbox panel. Lists messages persisted by the `outbox`
 * provider in `@loyalty/email`. Active in preview deploys (and
 * locally when `EMAIL_PROVIDER=outbox`). Empty in production since
 * Resend is the provider there.
 */
export async function OutboxList() {
  const api = await trpc();
  const { rows } = await api.emailOutbox.list({ page: 1, pageSize: 100 });

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Email Outbox</h1>
        <p className="text-sm text-muted-foreground">
          Emails enviados a través del provider <code>outbox</code> de{" "}
          <code>@loyalty/email</code>. Vacío en producción.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay emails</CardTitle>
            <CardDescription>
              Cuando algún flow dispare un email con el provider outbox, vas a
              verlo acá.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              ¿Esperás ver emails? Asegurate de que la app esté corriendo con{" "}
              <code>EMAIL_PROVIDER=outbox</code>.
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
                  <TableHead>Asunto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.sentAt.toISOString().replace("T", " ").slice(0, 19)}
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-[240px]">
                      {row.to}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "sent" ? "secondary" : "destructive"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={{
                          pathname: "/email-outbox/[id]",
                          params: { id: row.id },
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        {row.subject.slice(0, 80)}
                        {row.subject.length > 80 ? "…" : ""}
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
