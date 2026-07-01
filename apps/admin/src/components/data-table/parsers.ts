// Import the parser factories from `nuqs/server` (isomorphic + server-safe) so
// these definitions can be shared by client `useQueryState` AND the RSC
// `createLoader` without dragging client-only code into the server.
import {
  createParser,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

/** A single sort rule (mirrors the BE `SortItem`). */
export type SortRule = { id: string; desc: boolean };

/** Sort encoded in the URL as `field.dir,field.dir` (e.g. `createdAt.desc,name.asc`). */
export const parseAsSort = createParser<SortRule[]>({
  parse: (value) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [id, dir] = part.split(".");
        return { id: id ?? "", desc: dir === "desc" };
      })
      .filter((r) => r.id.length > 0),
  serialize: (rules) => rules.map((r) => `${r.id}.${r.desc ? "desc" : "asc"}`).join(","),
  eq: (a, b) =>
    a.length === b.length && a.every((r, i) => r.id === b[i]?.id && r.desc === b[i]?.desc),
});

export const VIEW_MODES = ["list", "grid"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

/** Shared parsers for the data-table URL state. `shallow: true` keeps the
 *  refetching client-side (react-query), with the RSC seeding only the first
 *  paint via `initialData`. */
export const tableParsers = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(25),
  sort: parseAsSort.withDefault([]),
  view: parseAsStringLiteral(VIEW_MODES).withDefault("list"),
  /** Hidden column ids. */
  cols: parseAsArrayOf(parseAsString).withDefault([]),
};

export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
