import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import type { StorybookConfig } from "@storybook/react-vite";

const here = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    check: false,
    reactDocgen: "react-docgen-typescript",
    // `apps/storybook/tsconfig.json` only includes the Storybook
    // files; the components Storybook documents live under
    // `packages/ui/src/components/ui/`. Point docgen-typescript at
    // the UI package's tsconfig so it can resolve, parse, and emit
    // props tables for every shadcn component.
    reactDocgenTypescriptOptions: {
      tsconfigPath: resolve(here, "../../../packages/ui/tsconfig.json"),
    },
  },
};

export default config;
