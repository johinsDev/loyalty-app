import { formatAddress, type StoreAddress } from "@loyalty/address";
import type { db as Db } from "@loyalty/db";
import type { StoreRow } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";

import { getBranding } from "../_shared/localize";
import type { ListResult } from "../_shared/list";
import type { StoresRepository } from "./repository";
import type {
  StoreListItem,
  StoresListInput,
  StoreSwitcherItem,
  StoreView,
  UpdateStoreInput,
} from "./schemas";
import { directionsUrl, generateStoreMap } from "./static-map";

/** Expand the structured address input into the persisted store columns:
 *  `address` (denormalized formatted string), `addressParts` (the object,
 *  with `formatted` recomputed), plus the `lat/lng/placeId` columns the map +
 *  directions read. `undefined` → no change; `null` → clear everything. */
function addressColumns(
  address: StoreAddress | null | undefined,
): Partial<StoreRow> {
  if (address === undefined) return {};
  if (address === null) {
    return { address: null, addressParts: null, lat: null, lng: null, placeId: null };
  }
  const formatted = formatAddress(address);
  return {
    address: formatted || null,
    addressParts: { ...address, formatted },
    lat: address.lat ?? null,
    lng: address.lng ?? null,
    placeId: address.placeId ?? null,
  };
}

/** Static-map generation deps, injected by the router from the request ctx. */
export interface MapDeps {
  disk?: {
    put(k: string, b: Uint8Array, o: { contentType: string }): Promise<{ key: string }>;
    getPublicUrl(k: string): string | null;
    getSignedUrl(k: string, e?: number): Promise<string>;
  };
  mapsKey?: string;
}

/**
 * Stores business logic: a wizard create/edit lifecycle (entity-as-draft) +
 * the customer's published reads. Branding/contact/schedule fields are stored
 * `null` to inherit the org's value, resolved at read time. Soft delete keeps
 * rows recoverable. On create/update with coordinates it regenerates the
 * Static Maps screenshot.
 */
export class StoresService {
  constructor(
    private readonly db: typeof Db,
    private readonly repo: StoresRepository,
  ) {}

  adminList(orgId: string, input: StoresListInput): Promise<ListResult<StoreListItem>> {
    return this.repo.adminList(orgId, input);
  }

  listByIds(orgId: string, ids: string[]): Promise<StoreListItem[]> {
    return this.repo.listByIds(orgId, ids);
  }

  /** Lean active-store list powering the admin store switcher. */
  switcherList(orgId: string): Promise<StoreSwitcherItem[]> {
    return this.repo.switcherList(orgId);
  }

  /** The primary store row (admin editing — e.g. the Settings location block). */
  primaryRow(orgId: string): Promise<StoreRow | null> {
    return this.repo.findPrimary(orgId, false);
  }

  async publicList(orgId: string): Promise<StoreView[]> {
    const [rows, branding] = await Promise.all([
      this.repo.list(orgId, true),
      getBranding(this.db, orgId),
    ]);
    return rows.map((r) => this.#toView(r, branding));
  }

  async primary(orgId: string): Promise<StoreView | null> {
    const [row, branding] = await Promise.all([
      this.repo.findPrimary(orgId, true),
      getBranding(this.db, orgId),
    ]);
    return row ? this.#toView(row, branding) : null;
  }

  get(orgId: string, id: string): Promise<StoreRow | null> {
    return this.repo.get(orgId, id);
  }

  /** Start a draft (optionally named from quick-create); the wizard fills the
   *  rest step by step, then publishes. */
  create(orgId: string, name?: string): Promise<StoreRow> {
    return this.repo.create(orgId, { name: name?.trim() ?? "", status: "draft" });
  }

  async update(orgId: string, input: UpdateStoreInput, deps: MapDeps): Promise<StoreRow> {
    const { id, address, logo, ...rest } = input;
    const cols = addressColumns(address);
    const row = await this.repo.patch(orgId, id, {
      ...rest,
      // "" clears the logo → inherit the org's.
      ...(logo !== undefined ? { logo: logo || null } : {}),
      ...cols,
    });
    // Regenerate the map only when this update set coordinates; if the address
    // was cleared, drop the stale screenshot.
    if (cols.lat != null && cols.lng != null) return this.#regenMap(orgId, row, deps);
    if (address === null && row.mapStaticUrl != null) {
      return this.repo.patch(orgId, id, { mapStaticUrl: null });
    }
    return row;
  }

  /** Validate the minimum + flip the draft live. */
  async publish(orgId: string, id: string): Promise<StoreRow> {
    const row = await this.repo.get(orgId, id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    if (!row.name.trim()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Store needs a name" });
    }
    return this.repo.patch(orgId, id, { status: "published" });
  }

  async setPrimary(orgId: string, id: string): Promise<{ ok: true }> {
    await this.repo.setPrimary(orgId, id);
    return { ok: true };
  }

  /** Soft delete. Refuses the last store; promotes another to primary first. */
  async remove(orgId: string, id: string): Promise<{ ok: true }> {
    const row = await this.repo.get(orgId, id);
    if (!row) return { ok: true };
    if ((await this.repo.countActive(orgId)) <= 1) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cannot delete the last store" });
    }
    if (row.isPrimary) await this.repo.promoteAnotherPrimary(orgId, id);
    await this.repo.softDelete(orgId, id);
    return { ok: true };
  }

  /** Bulk soft-delete. Refuses to wipe every store; keeps a primary. */
  async bulkRemove(orgId: string, ids: string[]): Promise<{ ok: true; deleted: number }> {
    const active = await this.repo.countActive(orgId);
    if (ids.length >= active) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Cannot delete every store — at least one must remain",
      });
    }
    await this.repo.bulkSoftDelete(orgId, ids);
    await this.repo.ensurePrimary(orgId);
    return { ok: true, deleted: ids.length };
  }

  async bulkSetPublished(
    orgId: string,
    ids: string[],
    isPublished: boolean,
  ): Promise<{ ok: true }> {
    await this.repo.bulkSetPublished(orgId, ids, isPublished);
    return { ok: true };
  }

  async #regenMap(orgId: string, row: StoreRow, deps: MapDeps): Promise<StoreRow> {
    if (row.lat == null || row.lng == null) return row;
    const url = await generateStoreMap({
      disk: deps.disk,
      key: deps.mapsKey,
      storeId: row.id,
      lat: row.lat,
      lng: row.lng,
    });
    if (!url) return row;
    return this.repo.patch(orgId, row.id, { mapStaticUrl: url });
  }

  /** Resolve org-inherited fields (store value ?? org default). */
  #toView(r: StoreRow, branding: Awaited<ReturnType<typeof getBranding>>): StoreView {
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      phone: r.phone ?? branding.phone,
      hours: (r.hours ?? branding.defaultHours ?? null) as StoreView["hours"],
      timezone: r.timezone,
      mapStaticUrl: r.mapStaticUrl,
      directionsUrl: directionsUrl(r),
      logo: r.logo ?? branding.logoUrl,
      socialLinks: (r.socialLinks ?? branding.socialLinks ?? {}) as Record<string, string>,
      isPrimary: r.isPrimary,
    };
  }
}
