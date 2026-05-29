import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "admin",
        "analytics",
        "web",
        "api",
        "auth",
        "cache",
        "db",
        "e2e",
        "email",
        "feature-flags",
        "jobs",
        "log",
        "push",
        "rate-limit",
        "realtime",
        "sms",
        "storage",
        "ui",
        "tooling",
        "whatsapp",
        "ci",
        "deps",
        "repo",
      ],
    ],
    "subject-case": [2, "never", ["pascal-case", "upper-case"]],
  },
};

export default config;
