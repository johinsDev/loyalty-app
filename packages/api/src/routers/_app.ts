import { emailOutboxRouter } from "../features/email-outbox";
import { notificationsRouter } from "../features/notifications";
import { promocionesRouter } from "../features/promotions";
import { pushOutboxRouter } from "../features/push-outbox";
import { pushTokensRouter } from "../features/push-tokens";
import { realtimeRouter } from "../features/realtime";
import { smsOutboxRouter } from "../features/sms-outbox";
import { storageRouter } from "../features/storage";
import { whatsappOutboxRouter } from "../features/whatsapp-outbox";
import { router } from "../trpc";
import { clientesRouter } from "./clientes";
import { healthRouter } from "./health";
import { premiosRouter } from "./premios";
import { sellosRouter } from "./sellos";

export const appRouter = router({
  health: healthRouter,
  clientes: clientesRouter,
  sellos: sellosRouter,
  premios: premiosRouter,
  notifications: notificationsRouter,
  promociones: promocionesRouter,
  emailOutbox: emailOutboxRouter,
  pushOutbox: pushOutboxRouter,
  pushTokens: pushTokensRouter,
  realtime: realtimeRouter,
  smsOutbox: smsOutboxRouter,
  storage: storageRouter,
  whatsappOutbox: whatsappOutboxRouter,
});

export type AppRouter = typeof appRouter;
