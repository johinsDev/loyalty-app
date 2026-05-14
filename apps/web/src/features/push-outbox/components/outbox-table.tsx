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
import { RelativeTime } from "@loyalty/date/react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { trpc } from "@/lib/trpc/server";

import { PaginationControls } from "./pagination-controls";

type Status = "sent" | "failed" | undefined;
type Platform = "webpush" | "expo" | undefined;

type Props = {
  deviceToken?: string;
  platform: Platform;
  status: Status;
  search?: string;
  page: number;
  pageSize: number;
};

/**
 * Server component that fetches a page of `push_outbox` rows and
 * renders the table + pagination. Each row links to the detail page
 * which renders the full payload as a JSON tree.
 */
export async function OutboxTable({
  deviceToken,
  platform,
  status,
  search,
  page,
  pageSize,
}: Props) {
  const locale = await getLocale();
  const t = await getTranslations("PushOutbox");
  const api = await trpc();
  const { rows, total } = await api.pushOutbox.list({
    deviceToken: deviceToken || undefined,
    platform,
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
              <TableHead className="w-[28%]">{t("colDevice")}</TableHead>
              <TableHead>{t("colTitle")}</TableHead>
              <TableHead className="w-[120px]">{t("colStatus")}</TableHead>
              <TableHead className="w-[140px]">{t("colSent")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const tokenPreview = formatToken(row.deviceToken, row.platform);
              const titlePreview =
                row.title.length > 80 ? `${row.title.slice(0, 80)}…` : row.title;
              return (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/${locale}/push-outbox/${row.id}`}
                      className="flex flex-col gap-1"
                    >
                      <span className="text-xs font-mono truncate max-w-[260px]">
                        {tokenPreview}
                      </span>
                      <Badge
                        variant={row.platform === "expo" ? "secondary" : "outline"}
                        className="w-fit"
                      >
                        {row.platform === "expo"
                          ? t("platformExpo")
                          : t("platformWebpush")}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-foreground/80">
                    {titlePreview}
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

/**
 * Compact human-readable summary of a device token. Expo tokens are
 * short enough to render whole; web push subscriptions hide the JSON
 * blob behind the endpoint hostname.
 */
function formatToken(token: string, platform: string): string {
  if (platform === "expo") {
    return token.length > 36 ? `${token.slice(0, 33)}…]` : token;
  }
  try {
    const sub = JSON.parse(token) as { endpoint?: string };
    if (sub.endpoint) {
      const url = new URL(sub.endpoint);
      return `${url.hostname}${url.pathname.slice(0, 16)}…`;
    }
  } catch {
    // fall through
  }
  return token.length > 32 ? `${token.slice(0, 32)}…` : token;
}
