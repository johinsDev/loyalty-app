import type { UserConfig } from "vitest/config";

/**
 * Shared base Vitest config for every internal package.
 * Use it from a package's `vitest.config.ts`:
 *
 * ```ts
 * import { defineConfig } from "vitest/config";
 * import { baseConfig } from "@loyalty/vitest-config";
 *
 * export default defineConfig(baseConfig());
 * ```
 *
 * Pass overrides if you need to extend it:
 *
 * ```ts
 * export default defineConfig(baseConfig({ test: { setupFiles: ["./test/setup.ts"] } }));
 * ```
 */
export function baseConfig(overrides: UserConfig = {}): UserConfig {
  const baseTest = {
    globals: false,
    environment: "node" as const,
    include: ["src/**/*.{test,spec}.ts", "src/**/__tests__/**/*.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.turbo/**", "**/.next/**"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8" as const,
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.ts",
        "src/**/__tests__/**",
        "src/**/factories.ts",
        "src/**/fake-*.ts",
        "src/index.ts",
      ],
    },
  };

  return {
    ...overrides,
    test: {
      ...baseTest,
      ...overrides.test,
      coverage: {
        ...baseTest.coverage,
        ...overrides.test?.coverage,
      },
    },
  };
}
