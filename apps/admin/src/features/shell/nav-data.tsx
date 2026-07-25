import { AdminNav } from "@/components/admin-nav";
import { getMe } from "@/lib/auth-guard";

/**
 * RSC hole for the sidebar. Resolves the member role + name (session cookie →
 * dynamic, so this only renders inside the layout's `<Suspense>`), then hands them
 * to the client {@link AdminNav}, which owns the interactive bits (active state,
 * collapsibles, ⌘K via context, self-owned nav counts, scoped links via
 * `useParams`). Deduped per request via `getMe`'s `cache()`.
 */
export async function NavData() {
  const me = await getMe();
  return <AdminNav role={me?.role ?? "staff"} name={me?.user.name?.trim() || "Equipo"} />;
}
