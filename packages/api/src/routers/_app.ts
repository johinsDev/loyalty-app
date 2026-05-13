import { smsOutboxRouter } from "../features/sms-outbox";
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
  smsOutbox: smsOutboxRouter,
  whatsappOutbox: whatsappOutboxRouter,
});

export type AppRouter = typeof appRouter;
