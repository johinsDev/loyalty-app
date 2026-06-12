"use client";

import {
  Button,
  Input,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Admin shortlinks: create a link (target URL + optional custom slug +
 * optional expiry) and list existing ones with click counts. Each row
 * links to its analytics detail. Owner/staff only (the router gates it).
 */
export function ShortlinksView() {
  const t = useTranslations("Shortlinks");
  const trpc = useTRPC();

  const list = useQuery(
    trpc.shortlinks.list.queryOptions({ page: 1, pageSize: 50 }),
  );
  const create = useMutation(trpc.shortlinks.create.mutationOptions());
  const deactivate = useMutation(trpc.shortlinks.deactivate.mutationOptions());

  const [targetUrl, setTargetUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const result = await create.mutateAsync({
        targetUrl,
        slug: slug.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });
      toast.success(t("created", { url: result.shortUrl }));
      setTargetUrl("");
      setSlug("");
      setExpiresAt("");
      await list.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("createError"));
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success(t("copied"));
  };

  const onDeactivate = async (id: string) => {
    await deactivate.mutateAsync({ id });
    await list.refetch();
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header>
        <h1 className="font-semibold text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </header>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2"
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="targetUrl">{t("targetUrl")}</Label>
          <Input
            id="targetUrl"
            type="url"
            required
            placeholder="https://app.t4diverclub.app/card"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">{t("slugOptional")}</Label>
          <Input
            id="slug"
            placeholder="promo-2x1"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expiresAt">{t("expiresOptional")}</Label>
          <Input
            id="expiresAt"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? t("creating") : t("create")}
          </Button>
        </div>
      </form>

      <TooltipProvider delay={150}>
        <section className="space-y-3">
        {list.isLoading ? (
          <p className="text-muted-foreground text-sm">{t("loading")}</p>
        ) : list.data && list.data.rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("colShort")}</th>
                  <th className="px-3 py-2 font-medium">{t("colTarget")}</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("colClicks")}
                  </th>
                  <th className="px-3 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.data.rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger className="block max-w-[220px] cursor-default truncate text-left font-mono text-muted-foreground text-xs">
                            {row.shortUrl}
                          </TooltipTrigger>
                          <TooltipContent>{row.shortUrl}</TooltipContent>
                        </Tooltip>
                        <button
                          type="button"
                          onClick={() => copy(row.shortUrl)}
                          title={t("copy")}
                          aria-label={t("copy")}
                          className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <CopyIcon className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-muted-foreground">
                      {row.targetUrl}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.clickCount}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.active
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                        }
                      >
                        {row.active ? t("active") : t("inactive")}
                      </span>
                    </td>
                    <td className="space-x-3 px-3 py-2 text-right">
                      <Link
                        href={{ pathname: "/shortlinks/[id]", params: { id: row.id } }}
                        className="text-primary hover:underline"
                      >
                        {t("analytics")}
                      </Link>
                      {row.active ? (
                        <button
                          type="button"
                          onClick={() => onDeactivate(row.id)}
                          className="text-destructive hover:underline"
                        >
                          {t("deactivate")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        )}
        </section>
      </TooltipProvider>
    </main>
  );
}
