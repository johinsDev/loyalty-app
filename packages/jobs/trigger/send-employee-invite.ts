import { renderEmployeeInviteEmail } from "@loyalty/email-templates";
import { logger, task } from "@trigger.dev/sdk/v3";

import { email } from "../email";

type Payload = {
  email: string;
  role: string;
  acceptUrl: string;
  organizationId: string;
};

const ROLE_LABELS: Record<string, string> = {
  staff: "Cajero",
  manager: "Gerente",
  owner: "Dueño",
};

// Delivers the staff invitation email. Enqueued from the employees service in
// the Worker (`employees.invite`) so the lean Worker never runs the mailer.
export const sendEmployeeInviteTask = task({
  id: "send-employee-invite",
  maxDuration: 30,
  run: async ({ email: to, role, acceptUrl }: Payload) => {
    logger.info("send-employee-invite start", { to, role });
    const html = await renderEmployeeInviteEmail({
      acceptUrl,
      roleLabel: ROLE_LABELS[role] ?? role,
      role,
      email: to,
    });
    await email.send((m) => {
      m.to(to).subject("Te invitaron al equipo de T4").html(html);
    });
    return { ok: true };
  },
});
