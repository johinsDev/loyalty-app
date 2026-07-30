import { describe, expect, it } from "vitest";

import type { EmployeesRepository } from "../repository";
import { EmployeesService } from "../service";

const ORG = "org_1";
const USER = "user_1";
const ASSIGNED = [{ id: "s1", name: "T4 Diverplaza" }];
const ALL = [
  { id: "s1", name: "T4 Diverplaza" },
  { id: "s2", name: "T4 Centro" },
];

/** Only the two reads `myStores` performs; the rest of the repo is irrelevant. */
function repoWith(assigned: typeof ASSIGNED) {
  const calls: string[] = [];
  const repo = {
    assignedStoresFor: async () => {
      calls.push("assigned");
      return assigned;
    },
    allStores: async () => {
      calls.push("all");
      return ALL;
    },
  } as unknown as EmployeesRepository;
  return { repo, calls };
}

describe("EmployeesService.myStores", () => {
  it("staff sees only their assignments", async () => {
    const { repo } = repoWith(ASSIGNED);
    const stores = await new EmployeesService(repo).myStores(ORG, USER, "staff");
    expect(stores).toEqual(ASSIGNED);
  });

  // The regression this guards: an unassigned cashier used to fall through to
  // every store and could ring up sales against a location they don't work at.
  it("unassigned staff sees nothing — never the whole org", async () => {
    const { repo, calls } = repoWith([]);
    const stores = await new EmployeesService(repo).myStores(ORG, USER, "staff");
    expect(stores).toEqual([]);
    expect(calls).not.toContain("all");
  });

  it("managers supervise every store", async () => {
    const { repo } = repoWith([]);
    const stores = await new EmployeesService(repo).myStores(ORG, USER, "manager");
    expect(stores).toEqual(ALL);
  });

  it("owners supervise every store, even when assigned to one", async () => {
    const { repo } = repoWith(ASSIGNED);
    const stores = await new EmployeesService(repo).myStores(ORG, USER, "owner");
    expect(stores).toEqual(ALL);
  });
});
