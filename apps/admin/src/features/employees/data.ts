export type Role = "owner" | "manager" | "staff";

export const ROLES: Role[] = ["owner", "manager", "staff"];

export type Status = "active" | "invited";

export type Employee = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  stamps: number;
  redemptions: number;
  status: Status;
};

/**
 * Design-first / hardcoded team roster. The seam later is the Better Auth
 * organization member + invitation model (one tRPC `employees.list` query).
 */
export const employees: Employee[] = [
  {
    id: "e1",
    name: "Ana Restrepo",
    initials: "AR",
    email: "ana@t4.co",
    role: "owner",
    stamps: 1284,
    redemptions: 312,
    status: "active",
  },
  {
    id: "e2",
    name: "Carlos Méndez",
    initials: "CM",
    email: "carlos@t4.co",
    role: "manager",
    stamps: 842,
    redemptions: 197,
    status: "active",
  },
  {
    id: "e3",
    name: "María López",
    initials: "ML",
    email: "maria@t4.co",
    role: "staff",
    stamps: 521,
    redemptions: 88,
    status: "active",
  },
  {
    id: "e4",
    name: "diego.torres",
    initials: "DT",
    email: "diego.torres@t4.co",
    role: "staff",
    stamps: 0,
    redemptions: 0,
    status: "invited",
  },
  {
    id: "e5",
    name: "valentina.r",
    initials: "VR",
    email: "valentina.r@t4.co",
    role: "manager",
    stamps: 0,
    redemptions: 0,
    status: "invited",
  },
];

export type LogType = "stamp" | "redemption" | "role" | "login";
export type EmployeeLog = { id: string; type: LogType; detail: string; ago: string };

/**
 * Per-employee activity feed. Design-first / hardcoded; the seam later is an
 * org-scoped audit-log query keyed by member id.
 */
export function getEmployeeLogs(id: string): EmployeeLog[] {
  const lead = id.charCodeAt(0) % 2 === 0 ? "Juan" : "María";
  return [
    { id: `${id}-l1`, type: "stamp", detail: `Otorgó 2 sellos a ${lead}`, ago: "hace 20 min" },
    { id: `${id}-l2`, type: "redemption", detail: "Canjeó Bubble tea gratis", ago: "hace 1 h" },
    { id: `${id}-l3`, type: "login", detail: "Inició sesión", ago: "hace 2 h" },
    { id: `${id}-l4`, type: "stamp", detail: "Otorgó 1 sello a Pedro Gómez", ago: "hace 4 h" },
    { id: `${id}-l5`, type: "role", detail: "Cambió a Gerente", ago: "ayer" },
    { id: `${id}-l6`, type: "redemption", detail: "Canjeó Topping gratis", ago: "ayer" },
    { id: `${id}-l7`, type: "stamp", detail: "Otorgó 3 sellos a Laura Díaz", ago: "hace 2 días" },
    { id: `${id}-l8`, type: "login", detail: "Inició sesión", ago: "hace 3 días" },
  ];
}

export function getActivitySeries(_id: string): number[] {
  return [4, 8, 6, 12, 9, 15, 11];
}

export type AuditEntry = {
  id: string;
  who: string;
  action: string;
  detail: string;
  ago: string;
};

export const audit: AuditEntry[] = [
  {
    id: "a1",
    who: "Ana",
    action: "otorgó 2 sellos a",
    detail: "María",
    ago: "hace 1 h",
  },
  {
    id: "a2",
    who: "Carlos",
    action: "canjeó una recompensa para",
    detail: "Juan Pérez",
    ago: "hace 3 h",
  },
  {
    id: "a3",
    who: "Ana",
    action: "invitó a",
    detail: "diego.torres@t4.co",
    ago: "hace 5 h",
  },
  {
    id: "a4",
    who: "María",
    action: "cambió el rol de",
    detail: "Carlos a Gerente",
    ago: "ayer",
  },
  {
    id: "a5",
    who: "Ana",
    action: "eliminó a",
    detail: "Pedro Gómez",
    ago: "hace 2 días",
  },
];
