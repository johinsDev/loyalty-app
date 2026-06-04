import { LogManager } from "@loyalty/log";

// Workers-safe logger: console channel only (pino is Node-only and never
// imported here). A Better Stack HTTP transport can be added later for the
// deployed Worker. See `.claude/skills/log/SKILL.md`.
export const log = new LogManager({
  default: "console",
  channels: { console: { channel: "console" } },
  minLevel: "info",
  baseBindings: { service: "api" },
}).logger();
