import { renderEmployeeEmailChangeEmail } from "@loyalty/email-templates";
import { logger, task } from "@trigger.dev/sdk/v3";

import { email } from "../email";

type Payload = {
  oldEmail: string | null;
  newEmail: string;
  organizationId: string;
};

// Security notice for an owner-initiated employee email change. Notifies both
// the OLD address (heads-up) and the NEW address (new login). Enqueued from
// `employees.changeEmail` in the Worker.
export const sendEmployeeEmailChangeTask = task({
  id: "send-employee-email-change",
  maxDuration: 30,
  run: async ({ oldEmail, newEmail }: Payload) => {
    logger.info("send-employee-email-change start", { newEmail });
    const subject = "Tu correo de acceso a T4 cambió";

    if (oldEmail && oldEmail !== newEmail) {
      const html = await renderEmployeeEmailChangeEmail({ newEmail, toOld: true });
      await email.send((m) => {
        m.to(oldEmail).subject(subject).html(html);
      });
    }

    const htmlNew = await renderEmployeeEmailChangeEmail({ newEmail, toOld: false });
    await email.send((m) => {
      m.to(newEmail).subject(subject).html(htmlNew);
    });
    return { ok: true };
  },
});
