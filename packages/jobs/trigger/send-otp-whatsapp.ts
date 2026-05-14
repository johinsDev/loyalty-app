import { logger, task } from "@trigger.dev/sdk/v3";

import { whatsapp } from "../whatsapp";

type Payload = {
  phoneNumber: string;
  code: string;
};

// Delivers the Better Auth phone-number OTP over WhatsApp. Triggered
// from the web auth route so the HTTP request returns immediately and
// the actual send happens here with retries (3 attempts, configured in
// trigger.config.ts).
export const sendOtpWhatsappTask = task({
  id: "send-otp-whatsapp",
  maxDuration: 30,
  run: async ({ phoneNumber, code }: Payload) => {
    logger.info("send-otp-whatsapp start", { phoneNumber });
    await whatsapp.send((m) => {
      m.to(phoneNumber).content(
        `Tu código de verificación T4 es: ${code}\n\nExpira en 5 minutos.`,
      );
    });
    return { ok: true };
  },
});
