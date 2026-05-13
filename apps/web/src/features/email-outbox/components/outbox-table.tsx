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
 * Server component that fetches a page of `email_outbox` rows and
 * renders the table + pagination. Each row links to the detail page
 * which renders the persisted HTML body in a sandboxed iframe.
 */
export async function OutboxTable({ to, status, search, page, pageSize }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("EmailOutbox");
  const api = await trpc();
  const { rows, total } = await api.emailOutbox.list({
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
              <TableHead className="w-[28%]">{t("colRecipient")}</TableHead>
              <TableHead>{t("colSubject")}</TableHead>
              <TableHead className="w-[120px]">{t("colStatus")}</TableHead>
              <TableHead className="w-[140px]">{t("colSent")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const initials = recipientInitials(row.to);
              const hue = recipientHue(row.to);
              const preview =
                row.subject.length > 80
                  ? `${row.subject.slice(0, 80)}…`
                  : row.subject;
              return (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/${locale}/email-outbox/${row.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback
                          className={`${hue} text-white text-xs font-medium`}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate max-w-[220px]">
                        {row.to}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-foreground/80">
                    {preview}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "sent" ? "secondary" : "destructive"
                      }
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

function recipientInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "??";
  const at = trimmed.indexOf("@");
  const local = at > 0 ? trimmed.slice(0, at) : trimmed;
  const parts = local
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "??";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function recipientHue(value: string): string {
  let h = 0;
  for (const c of value) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]!;
}
