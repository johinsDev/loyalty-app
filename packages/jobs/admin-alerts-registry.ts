import {
  ADMIN_ALERTS,
  type AdminAlertType,
} from "@loyalty/api/features/admin-notifications";
import {
  Notification,
  type ChannelName,
  type NotificationRenderers,
} from "@loyalty/notifications";

/**
 * Operator alerts — the inbox behind the bell in the admin sidebar.
 *
 * One parameterised class instead of twelve near-identical subclasses: an
 * alert is data (type + severity + copy), and the only per-type variation is
 * the wording, which `buildCopy` owns.
 *
 * Note what is NOT here: `realtime`. A `notifier.send` runs once per
 * recipient, so a realtime channel would publish N identical frames for one
 * event. The job publishes a single org-wide signal after the fan-out instead.
 */
export interface AdminAlertInit {
  type: AdminAlertType;
  severity: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  storeId?: string | null;
  data?: Record<string, unknown>;
}

export class AdminAlertNotification
  extends Notification
  implements NotificationRenderers
{
  /** Internal, never marketing — an operator can't opt out of being told. */
  readonly category = "transactional" as const;

  constructor(private readonly alert: AdminAlertInit) {
    super();
  }

  via(): ChannelName[] {
    // The inbox always gets it. Critical alerts also leave the app, because
    // "someone is impersonating a user" shouldn't wait for the next login.
    return this.alert.severity === "critical"
      ? ["database", "mail"]
      : ["database"];
  }

  toDatabase() {
    return {
      type: this.alert.type,
      title: this.alert.title,
      body: this.alert.body,
      severity: this.alert.severity,
      entityType: this.alert.entityType,
      entityId: this.alert.entityId,
      storeId: this.alert.storeId,
      data: this.alert.data,
    };
  }

  toMail() {
    return {
      subject: this.alert.title,
      html: `<p>${escapeHtml(this.alert.body)}</p>`,
      text: this.alert.body,
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Payload the emitters put on the wire (untyped there to avoid a cycle). */
export interface AdminAlertContext {
  /** Display name of the entity the alert is about, resolved by the job. */
  entityName?: string | null;
  /** Display name of whoever triggered it. */
  actorName?: string | null;
  entity?: { type: string; id: string };
  storeId?: string | null;
  payload?: Record<string, unknown>;
}

const ROLE_LABELS: Record<string, string> = {
  staff: "cajero",
  manager: "encargado",
  owner: "dueño",
};

function roleLabel(value: unknown): string {
  return typeof value === "string" ? (ROLE_LABELS[value] ?? value) : "—";
}

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Signed amount, so a deduction reads as a deduction. */
function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function buildCopy(
  type: AdminAlertType,
  ctx: AdminAlertContext,
): { title: string; body: string } {
  const p = ctx.payload ?? {};
  const who = ctx.entityName ?? "un cliente";
  const employee = ctx.entityName ?? "un empleado";
  const actor = ctx.actorName ?? "alguien del equipo";
  const reason = str(p.reason);

  switch (type) {
    case "staff-role-changed":
      return {
        title: "Cambio de rol",
        body: `${actor} cambió a ${employee} de ${roleLabel(p.from)} a ${roleLabel(p.to)}.`,
      };
    case "staff-disabled":
      return {
        title: "Empleado inhabilitado",
        body: `${actor} inhabilitó a ${employee}${reason ? `: ${reason}` : "."}`,
      };
    case "impersonation-started":
      return {
        title: "Sesión suplantada",
        body: `${actor} entró a la cuenta de ${employee}.`,
      };
    case "invite-accepted":
      return {
        title: "Nuevo miembro del equipo",
        body: `${employee} aceptó la invitación como ${roleLabel(p.role)}.`,
      };
    case "customer-banned":
      return {
        title: "Cliente bloqueado",
        body: `${actor} bloqueó a ${who}${reason ? `: ${reason}` : "."}`,
      };
    case "points-adjusted":
      return {
        title: "Ajuste manual de puntos",
        body: `${actor} le ajustó ${signed(num(p.points))} puntos a ${who}${reason ? `: ${reason}` : "."}`,
      };
    case "stamps-adjusted":
      return {
        title: "Ajuste manual de sellos",
        body: `${actor} le ajustó ${signed(num(p.delta))} sellos a ${who}${reason ? `: ${reason}` : "."}`,
      };
    case "purchase-voided": {
      const parts: string[] = [];
      if (num(p.stamps) > 0) parts.push(`${num(p.stamps)} sellos`);
      if (num(p.points) > 0) parts.push(`${num(p.points)} puntos`);
      const undone =
        parts.length > 0 ? ` Se revirtieron ${parts.join(" y ")}.` : "";
      return {
        title: "Compra anulada",
        body: `${actor} anuló una compra${reason ? ` (${reason})` : ""}.${undone}`,
      };
    }
    case "campaign-finished":
      return {
        title: "Campaña enviada",
        body: `«${ctx.entityName ?? "Tu campaña"}» llegó a ${num(p.sent)} de ${num(p.recipients)} destinatarios.`,
      };
    case "campaign-failures":
      return {
        title: "Campaña con envíos fallidos",
        body: `«${ctx.entityName ?? "Tu campaña"}»: fallaron ${num(p.failed)} de ${num(p.recipients)} envíos.`,
      };
    case "customer-signup":
      return {
        title: "Cliente nuevo",
        body: `${who} se registró en el programa.`,
      };
    case "daily-digest": {
      const bits = [
        `${num(p.purchases)} ventas`,
        `${num(p.signups)} clientes nuevos`,
        `${num(p.redemptions)} canjes`,
      ];
      const adjustments = num(p.adjustments);
      if (adjustments > 0) bits.push(`${adjustments} ajustes manuales`);
      return {
        title: "Resumen del día",
        body: `Ayer: ${bits.join(", ")}.`,
      };
    }
  }
}

/**
 * Build the notification for an alert type. Mirrors `createNotification` in
 * the customer registry — the wire payload is untyped, so this is where it
 * becomes something renderable.
 */
export function createAdminAlert(
  type: AdminAlertType,
  ctx: AdminAlertContext = {},
): AdminAlertNotification {
  const { title, body } = buildCopy(type, ctx);
  return new AdminAlertNotification({
    type,
    severity: ADMIN_ALERTS[type].severity,
    title,
    body,
    entityType: ctx.entity?.type,
    entityId: ctx.entity?.id,
    storeId: ctx.storeId ?? null,
    data: ctx.payload,
  });
}
