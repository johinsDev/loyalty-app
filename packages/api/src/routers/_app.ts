import { bannersRouter } from "../features/banners";
import { emailOutboxRouter } from "../features/email-outbox";
import { flagsRouter } from "../features/flags";
import { menuRouter } from "../features/products";
import { notificationsRouter } from "../features/notifications";
import { promocionesRouter } from "../features/promotions";
import { pushOutboxRouter } from "../features/push-outbox";
import { pushTokensRouter } from "../features/push-tokens";
import { realtimeRouter } from "../features/realtime";
import { settingsRouter } from "../features/settings";
import { pointsRouter } from "../features/points";
import { stampsRouter } from "../features/stamps";
import { streaksRouter } from "../features/streaks";
import { shortlinksRouter } from "../features/shortlinks";
import { smsOutboxRouter } from "../features/sms-outbox";
import { storageRouter } from "../features/storage";
import { whatsappOutboxRouter } from "../features/whatsapp-outbox";
import { router } from "../trpc";
import { authRouter } from "./auth";
import { customersRouter } from "./customers";
import { healthRouter } from "./health";
import { premiosRouter } from "./premios";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  customers: customersRouter,
  stamps: stampsRouter,
  streaks: streaksRouter,
  points: pointsRouter,
  menu: menuRouter,
  banners: bannersRouter,
  settings: settingsRouter,
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
