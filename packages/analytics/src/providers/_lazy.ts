/**
 * Function-constructor wrapper around `import()` so the bundler can't
 * statically trace the specifier — keeps the optional provider deps
 * (`posthog-node`, `posthog-js`) out of the build graph unless the
 * matching provider is actually selected at runtime.
 */
const importer = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<unknown>;

export function dynamicImport(specifier: string): Promise<unknown> {
  return importer(specifier);
}
