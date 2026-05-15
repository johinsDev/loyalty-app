import { createAuth } from "@loyalty/auth/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { toNextJsHandler } from "better-auth/next-js";

import { getAppUrl } from "@/lib/app-url";
import { log } from "@/lib/log";

import type { sendOtpWhatsappTask } from "@loyalty/jobs/trigger/send-otp-whatsapp";

const auth = createAuth(
  {
    sendOtp: async ({ phoneNumber, code }) => {
      await tasks.trigger<typeof sendOtpWhatsappTask>("send-otp-whatsapp", {
        phoneNumber,
        code,
      });
      log.info({ phoneNumber }, "auth.phoneNumber.sendOtp.queued");
    },
  },
  { baseURL: getAppUrl() },
);

export const { GET, POST } = toNextJsHandler(auth.handler);
