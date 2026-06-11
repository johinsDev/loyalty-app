import {
  type ChannelConfig,
  LogManager,
  type LogLevel,
} from "@loyalty/log";

import { env } from "./env";

// Workers-safe logger: console + (when a token is set) the Better Stack HTTP
// transport. Pino (Node-only) is never imported here. See `.claude/skills/log`.
const channels = {
  console: { channel: "console" },
  silent: { channel: "silent" },
  ...(env.BETTER_STACK_SOURCE_TOKEN && {
    "better-stack": {
      channel: "better-stack",
      sourceToken: env.BETTER_STACK_SOURCE_TOKEN,
      ...(env.BETTER_STACK_INGESTING_HOST && {
        host: env.BETTER_STACK_INGESTING_HOST,
      }),
    },
  }),
} as Record<string, ChannelConfig>;

const minLevel = (env.LOG_LEVEL as LogLevel | undefined) ?? "info";

export const log = new LogManager({
  default: env.BETTER_STACK_SOURCE_TOKEN ? "better-stack" : "console",
  channels,
  minLevel,
  baseBindings: { service: "api", env: env.APP_ENV ?? "development" },
}).logger();
