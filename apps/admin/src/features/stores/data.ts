// Hardcoded store data for the design-first Tiendas CRUD. Seam: a store maps onto
// the Phase B `store` / location model (one tenant, many branches). The list rows,
// member counts and status come from tRPC later.

export type Status = "active" | "inactive";

export type Store = {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  members: number;
  status: Status;
};

export const STATUSES: Status[] = ["active", "inactive"];

export const stores: Store[] = [
  {
    id: "s_001",
    name: "T4 Centro",
    address: "Cra. 7 #12-34, Bogotá",
    phone: "+57 601 555 0110",
    hours: "10:00–21:00",
    members: 6,
    status: "active",
  },
  {
    id: "s_002",
    name: "T4 Norte",
    address: "Cl. 116 #15-20, Bogotá",
    phone: "+57 601 555 0120",
    hours: "11:00–22:00",
    members: 4,
    status: "active",
  },
  {
    id: "s_003",
    name: "T4 Sur",
    address: "Av. Villavicencio #50-12, Bogotá",
    phone: "+57 601 555 0130",
    hours: "10:00–20:00",
    members: 0,
    status: "inactive",
  },
];

// Editable draft used by the create/edit modal. Mirrors the list row minus the
// derived fields (id, members) that aren't user-entered in the design build.
export type StoreDraft = {
  name: string;
  address: string;
  phone: string;
  hours: string;
};

export const emptyStoreDraft: StoreDraft = {
  name: "",
  address: "",
  phone: "",
  hours: "",
};

/** Resolve a store into an editable draft. Hardcoded — unknown ids fall back to
 * the first store so deep links never 404 in the design build. */
export function getStoreDraft(id: string): StoreDraft {
  const base = stores.find((s) => s.id === id) ?? stores[0]!;
  return {
    name: base.name,
    address: base.address,
    phone: base.phone,
    hours: base.hours,
  };
}
