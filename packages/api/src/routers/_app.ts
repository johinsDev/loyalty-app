import { emailOutboxRouter } from "../features/email-outbox";
import { flagsRouter } from "../features/flags";
import { notificationsRouter } from "../features/notifications";
import { promocionesRouter } from "../features/promotions";
import { pushOutboxRouter } from "../features/push-outbox";
import { pushTokensRouter } from "../features/push-tokens";
import { realtimeRouter } from "../features/realtime";
import { shortlinksRouter } from "../features/shortlinks";
import { smsOutboxRouter } from "../features/sms-outbox";
import { storageRouter } from "../features/storage";
import { whatsappOutboxRouter } from "../features/whatsapp-outbox";
import { router } from "../trpc";
import { authRouter } from "./auth";
import { clientesRouter } from "./clientes";
import { healthRouter } from "./health";
import { premiosRouter } from "./premios";
import { sellosRouter } from "./sellos";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  clientes: clientesRouter,
  sellos: sellosRouter,
  premios: premiosRouter,
  notifications: notificationsRouter,
  promociones: promocionesRouter,
  emailOutbox: emailOutboxRouter,
  flags: flagsRouter,
  pushOutbox: pushOutboxRouter,
  pushTokens: pushTokensRouter,
  realtime: realtimeRouter,
  shortlinks: shortlinksRouter,
  smsOutbox: smsOutboxRouter,
  storage: storageRouter,
  whatsappOutbox: whatsappOutboxRouter,
});

export type AppRouter = typeof appRouter;
