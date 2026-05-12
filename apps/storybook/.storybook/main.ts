import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    check: false,
    // `react-docgen` (the plain-JS docgen) works on shadcn's
    // components without needing a TS Program. Tried
    // `react-docgen-typescript` first; Storybook's vite plugin loads
    // a TS project rooted at cwd and silently ignores include
    // additions from monorepo paths, so every component under
    // `packages/ui/src/**` ends up in the "Skipping docgen … not in
    // the active TypeScript project" list. `react-docgen` parses
    // the file directly and emits the props table from the function
    // signature — less precise on union types, but zero warnings
    // and works across the monorepo.
    reactDocgen: "react-docgen",
  },
};

export default config;
