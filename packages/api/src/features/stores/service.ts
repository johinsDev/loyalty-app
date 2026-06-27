import { formatAddress, type StoreAddress } from "@loyalty/address";
import type { db as Db } from "@loyalty/db";
import type { StoreRow } from "@loyalty/db/schema";

import type { StoresRepository } from "./repository";
import type { CreateStoreInput, StoreView, UpdateStoreInput } from "./schemas";
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

/** Stores business logic: admin CRUD + the customer's published reads. On
 *  create/update with coordinates it regenerates the Static Maps screenshot. */
export class StoresService {
  constructor(
    private readonly db: typeof Db,
    private readonly repo: StoresRepository,
  ) {}

  adminList(orgId: string): Promise<StoreRow[]> {
    return this.repo.list(orgId, false);
  }

  publicList(orgId: string): Promise<StoreView[]> {
    return this.repo.list(orgId, true).then((rows) => rows.map((r) => this.#toView(r)));
  }

  async primary(orgId: string): Promise<StoreView | null> {
    const row = await this.repo.findPrimary(orgId, true);
    return row ? this.#toView(row) : null;
  }

  async get(orgId: string, id: string): Promise<StoreRow | null> {
    return this.repo.get(orgId, id);
  }

  async create(orgId: string, input: CreateStoreInput, deps: MapDeps): Promise<StoreRow> {
    const { address, ...rest } = input;
    const row = await this.repo.create(orgId, { ...rest, ...addressColumns(address) });
    return this.#regenMap(orgId, row, deps);
  }

  async update(orgId: string, input: UpdateStoreInput, deps: MapDeps): Promise<StoreRow> {
    const { id, address, ...rest } = input;
    const cols = addressColumns(address);
    const row = await this.repo.patch(orgId, id, { ...rest, ...cols });
    // Regenerate the map only when this update set coordinates; if the address
    // was cleared, drop the stale screenshot.
    if (cols.lat != null && cols.lng != null) return this.#regenMap(orgId, row, deps);
    if (address === null && row.mapStaticUrl != null) {
      return this.repo.patch(orgId, id, { mapStaticUrl: null });
    }
    return row;
  }

  async setPrimary(orgId: string, id: string): Promise<{ ok: true }> {
    await this.repo.setPrimary(orgId, id);
    return { ok: true };
  }

  async remove(orgId: string, id: string): Promise<{ ok: true }> {
    await this.repo.remove(orgId, id);
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

  #toView(r: StoreRow): StoreView {
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      phone: r.phone,
      hours: (r.hours ?? null) as StoreView["hours"],
      timezone: r.timezone,
      mapStaticUrl: r.mapStaticUrl,
      directionsUrl: directionsUrl(r),
      isPrimary: r.isPrimary,
    };
  }
}
