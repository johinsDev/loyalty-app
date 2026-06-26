# Store / Brand config (multi-local) — living doc

> Doc vivo: vamos agregando aquí lo pendiente del feature de configuración de
> tienda/marca. Decisiones cerradas en grill-me + backlog para iterar.

## Contexto
La `organization` solo guarda `name/slug/logo/metadata`; `organization_settings`
(1:1 con org) solo guardaba localización (locale/currency) — la extendemos con el
branding. El admin tiene secciones de Settings + un feature `stores` **mock**.
Horas/tz de tienda hardcodeadas en `streaks/config.ts`. El cliente ya tiene `/store`
(single-store) + fila "Store" en el perfil. Los listeners de celebración (sellos/
racha/puntos) se montan solo en `Home()` → **no globales**.

## Decisiones cerradas (grill)
- **Multi-local**: tabla `store` (N por org). Marca = org, Sucursal = ubicación.
- **Branding (org)** extiende `organization_settings`: descripción, color de marca,
  redes, T&C (PDF), SEO, `loyaltyScope`. (`name`+`logo` siguen en `organization`.)
- **Maps**: `AddressAutocomplete` extendido → `placeId`+lat/lng. Cliente ve
  **screenshot estático** (Static Maps generado 1 vez al guardar → R2 → image-loader)
  + "Cómo llegar" (deep link keyless). Key Static Maps = server-side.
- **Colores = re-tematizar toda la app**: color de marca → `--primary/--ring/
  --primary-foreground` vía `<style>` SSR (Tailwind v4 tokens en `:root`/`.dark`).
- **Cliente multi-local**: `/store` lista publicadas; **switcher** si >1 (nombre por
  sucursal); con 1 sola → info directa. Geo opcional (cercanía, fallback principal).
  Perfil muestra la **principal**.
- **Billetera**: flag `loyaltyScope: 'org'|'store'` (default 'org'); enforcement
  por-tienda = backlog.
- **T&C** = subir **PDF** a R2.
- **Horas**: `streaks/config.ts` lee horas+tz de la **sucursal principal**.
- **Admin cableado**: Marca + SEO + Tiendas (CRUD) + toggle `loyaltyScope`. Mock que
  queda: Loyalty(reglas), Onboarding, Team, Integraciones.

## Modelo de datos
- **`organization_settings` (+cols)**: `description`, `brandColor`, `socialLinks`
  (json), `termsPdfUrl`, `loyaltyScope`, `seoTitle`, `seoDescription`, `seoKeywords`
  (json), `ogImageUrl`.
- **`store`**: `id`, `organizationId`, `name`, `slug?`, `address`, `lat`, `lng`,
  `placeId`, `phone`, `hours` (json 7 días open/close/closed), `timezone`,
  `mapStaticUrl`, `isPrimary`, `isPublished`, `sortOrder`, timestamps.

## Plan de ejecución (fases)
1. Doc + schema (`organization_settings` + `store`) + migración.
2. Backend: routers `organization`(settings) + `stores` + static-map util + cache
   branding + cableo horas → streaks.
3. Theming: `brandTheme(hex)` + inyección SSR (web + admin).
4. UI: `ImageCropper` reusable + `AddressAutocomplete` (lat/lng/placeId).
5. Admin: BrandSection + SeoSection + Stores CRUD + toggle loyaltyScope (real).
6. Web: `/store` multi-local (switcher) + resumen en perfil + branding/theme.
7. Realtime global + env/Infisical + seed + validate + smoke.

## Env / Infisical
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (client, referrer-restricted → Places).
- `GOOGLE_MAPS_API_KEY` (server, Static Maps). En `.env.example` + `env.ts` + Infisical.

---

## Backlog (agregar libremente)
### Nota knip (resuelto — no bloquea)
- `bun run knip` en ESTE worktree marca 15 símbolos de API pública en archivos que
  no toqué — **falso positivo del entorno**: el worktree vive anidado dentro del
  repo principal (`.claude/worktrees/...`) y eso confunde la detección de monorepo
  de knip. Probado con `git stash -u` (main puro en este worktree) → igual marca 15;
  un worktree fresco standalone (`/tmp`) de `origin/main` → knip verde (exit 0). CI
  hace checkout standalone → **knip pasa**. typecheck/lint/test verdes.

### Diferido de este feature
- **Cablear horas reales → streaks** (recordatorio de racha). Requiere
  parametrizar `streak-calendar.ts` por `schedule` (tz+hours) y enhebrarlo en
  `advanceForPurchase`/`view`/cron + el cómputo del `day`. Riesgoso/delicado
  (lógica testeada) → paso propio con pasada de tests. Las horas ya viven en
  `store`; `streaks/config.ts` sigue siendo el seam. Un `loadStoreSchedule(db,
  orgId)` (lee la sucursal principal, fallback a las constantes) es el punto de
  entrada.
- **Billetera por-tienda (enforcement)** con `loyaltyScope='store'` (ledger keyed por
  store; caja elige tienda; reportes por tienda). Feature propio.
- **Geo "tienda más cercana"** (permiso + distancia; hoy fallback principal).
- **T&C "más pro"**: versionado + consent log por usuario.
- **Theming multi-tenant per-request** (SaaS); hoy single-org-per-deploy.
- **Branding override por sucursal**; color secundario / paleta completa.

### Secciones admin aún mock
- Loyalty (reglas earn/redeem), Onboarding (carrusel), Team (members/invites),
  Integraciones (credenciales WhatsApp/IG/Google/Resend/PostHog).

### Pendientes de features previos
- `pointsMultiplier` (Promos): aplicable pero no dobla el ledger aún.
- Promos: picker variante/modificador en scope; montos por-moneda.
- **Rediseño caja + seguridad presencia en compra** (QR-first, código solo manual;
  reward preseleccionado; freeItem obliga compra). PR propio + grill-me.
