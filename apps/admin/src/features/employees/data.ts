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

// ── Employee profile draft (edited in the stepper) ──────────────────────

/**
 * Editable employee profile — the full data an employee carries (mirrors what
 * customers will have). `initials`, `stamps`, `redemptions` are display-only in
 * the design build (shown in the wizard preview). Seam: the member + profile
 * model later.
 */
export type EmployeeDraft = {
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: Status;
  dailyCap: number;
  notes: string;
  initials: string;
  stamps: number;
  redemptions: number;
};

export const emptyEmployeeDraft: EmployeeDraft = {
  name: "",
  email: "",
  phone: "",
  role: "staff",
  status: "invited",
  dailyCap: 50,
  notes: "",
  initials: "",
  stamps: 0,
  redemptions: 0,
};

/** Resolve an employee into an editable draft. Hardcoded — unknown ids fall back
 * to the first employee so deep links never 404 in the design build. */
export function getEmployeeDraft(id: string): EmployeeDraft {
  const e = employees.find((x) => x.id === id) ?? employees[0]!;
  return {
    name: e.name,
    email: e.email,
    phone: "+57 320 555 0142",
    role: e.role,
    status: e.status,
    dailyCap: 50,
    notes: "",
    initials: e.initials,
    stamps: e.stamps,
    redemptions: e.redemptions,
  };
}

/** A 7-point activity series for the wizard preview chart. */
export function getActivitySeries(_id: string): number[] {
  return [4, 8, 6, 12, 9, 15, 11];
}

// ── Audit log (its own filterable view) ─────────────────────────────────

export type LogType = "stamp" | "redemption" | "role" | "login";
export const LOG_TYPES: LogType[] = ["stamp", "redemption", "role", "login"];

export type AuditLogEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LogType;
  detail: string;
  /** Days before "today" — the view derives a Date so range/quick filters work. */
  daysAgo: number;
  /** Local time of day, HH:MM. */
  time: string;
};

/** Hardcoded org-wide audit trail. Seam: an append-only `audit_log` table the
 * staff actions write to, queried with the same filters (employee, type, date). */
export const auditLog: AuditLogEntry[] = [
  { id: "l1", employeeId: "e1", employeeName: "Ana Restrepo", type: "stamp", detail: "Otorgó 2 sellos a María", daysAgo: 0, time: "14:32" },
  { id: "l2", employeeId: "e2", employeeName: "Carlos Méndez", type: "redemption", detail: "Canjeó una recompensa para Juan Pérez", daysAgo: 0, time: "12:05" },
  { id: "l3", employeeId: "e1", employeeName: "Ana Restrepo", type: "login", detail: "Inició sesión", daysAgo: 0, time: "09:01" },
  { id: "l4", employeeId: "e3", employeeName: "María López", type: "stamp", detail: "Otorgó 1 sello a Laura Díaz", daysAgo: 1, time: "18:44" },
  { id: "l5", employeeId: "e2", employeeName: "Carlos Méndez", type: "role", detail: "Cambió a Gerente", daysAgo: 1, time: "11:20" },
  { id: "l6", employeeId: "e3", employeeName: "María López", type: "redemption", detail: "Canjeó Topping gratis para Pedro Gómez", daysAgo: 1, time: "10:10" },
  { id: "l7", employeeId: "e1", employeeName: "Ana Restrepo", type: "stamp", detail: "Otorgó 3 sellos a Laura Díaz", daysAgo: 2, time: "16:50" },
  { id: "l8", employeeId: "e2", employeeName: "Carlos Méndez", type: "login", detail: "Inició sesión", daysAgo: 2, time: "08:55" },
  { id: "l9", employeeId: "e1", employeeName: "Ana Restrepo", type: "role", detail: "Invitó a diego.torres@t4.co", daysAgo: 3, time: "15:12" },
  { id: "l10", employeeId: "e3", employeeName: "María López", type: "stamp", detail: "Otorgó 1 sello a Sofía Ruiz", daysAgo: 3, time: "13:30" },
  { id: "l11", employeeId: "e2", employeeName: "Carlos Méndez", type: "redemption", detail: "Canjeó Bubble tea gratis para Ana V.", daysAgo: 5, time: "17:05" },
  { id: "l12", employeeId: "e1", employeeName: "Ana Restrepo", type: "role", detail: "Eliminó a Pedro Gómez", daysAgo: 6, time: "10:40" },
  { id: "l13", employeeId: "e3", employeeName: "María López", type: "login", detail: "Inició sesión", daysAgo: 8, time: "09:15" },
  { id: "l14", employeeId: "e2", employeeName: "Carlos Méndez", type: "stamp", detail: "Otorgó 2 sellos a Mateo R.", daysAgo: 12, time: "19:20" },
];
