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
 * Push Outbox panel. Lists notifications persisted by the `outbox`
 * provider in `@loyalty/push`. Active in preview deploys (and locally
 * when `PUSH_PROVIDER=outbox`). Empty in production since the `auto`
 * provider ships directly to webpush + expo.
 */
export async function OutboxList() {
  const api = await trpc();
  const { rows } = await api.pushOutbox.list({ page: 1, pageSize: 100 });

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Push Outbox</h1>
        <p className="text-sm text-muted-foreground">
          Notificaciones enviadas a través del provider <code>outbox</code> de{" "}
          <code>@loyalty/push</code>. Vacío en producción.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay notificaciones</CardTitle>
            <CardDescription>
              Cuando algún flow dispare un push con el provider outbox, vas a
              verlo acá.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              ¿Esperás ver notificaciones? Asegurate de que la app esté
              corriendo con <code>PUSH_PROVIDER=outbox</code>.
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
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Título</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.sentAt.toISOString().replace("T", " ").slice(0, 19)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.platform === "expo" ? "secondary" : "outline"
                        }
                      >
                        {row.platform}
                      </Badge>
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
                          pathname: "/push-outbox/[id]",
                          params: { id: row.id },
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        {row.title.slice(0, 80)}
                        {row.title.length > 80 ? "…" : ""}
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
