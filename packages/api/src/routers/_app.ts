import { router } from "../trpc";
import { clientesRouter } from "./clientes";
import { healthRouter } from "./health";
import { premiosRouter } from "./premios";
import { sellosRouter } from "./sellos";
import { whatsappOutboxRouter } from "./whatsapp-outbox";

export const appRouter = router({
  health: healthRouter,
  clientes: clientesRouter,
  sellos: sellosRouter,
  premios: premiosRouter,
  whatsappOutbox: whatsappOutboxRouter,
});

export type AppRouter = typeof appRouter;
