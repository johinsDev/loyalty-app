import {
  Avatar,
  AvatarFallback,
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
import { RelativeTime } from "@loyalty/date/react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { trpc } from "@/lib/trpc/server";

import { PaginationControls } from "./pagination-controls";

type Status = "sent" | "failed" | undefined;

type Props = {
  to?: string;
  status: Status;
  search?: string;
  page: number;
  pageSize: number;
};

const AVATAR_PALETTE = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

/**
 * Server component that fetches a page of `whatsapp_outbox` rows and
 * renders the table + pagination. Each row links to the detail page.
 */
export async function OutboxTable({ to, status, search, page, pageSize }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("WhatsAppOutbox");
  const api = await trpc();
  const { rows, total } = await api.whatsappOutbox.list({
    to: to || undefined,
    status,
    search: search || undefined,
    page,
    pageSize,
  });

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("emptyTitle")}</CardTitle>
          <CardDescription>{t("emptyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          <p>{t("emptyHint")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[36%]">{t("colRecipient")}</TableHead>
              <TableHead>{t("colBody")}</TableHead>
              <TableHead className="w-[120px]">{t("colStatus")}</TableHead>
              <TableHead className="w-[160px]">{t("colSent")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const initials = phoneInitials(row.to);
              const hue = phoneHue(row.to);
              const preview =
                row.content.length > 80
                  ? `${row.content.slice(0, 80)}…`
                  : row.content;
              return (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/${locale}/whatsapp-outbox/${row.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className={`${hue} text-white text-xs font-medium`}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-mono text-sm">{row.to}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-foreground/80">{preview}</TableCell>
                  <TableCell>
                    <Badge
                      variant={row.status === "sent" ? "secondary" : "destructive"}
                    >
                      {row.status === "sent" ? t("statusSent") : t("statusFailed")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <RelativeTime date={row.sentAt} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      <CardContent className="border-t py-3">
        <PaginationControls total={total} pageSize={pageSize} />
      </CardContent>
    </Card>
  );
}

function phoneInitials(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.slice(-2) || "??";
}

function phoneHue(phone: string): string {
  let h = 0;
  for (const c of phone) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]!;
}
