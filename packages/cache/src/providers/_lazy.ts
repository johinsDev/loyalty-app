/**
 * Function-constructor wrapper around `import()` so the bundler can't
 * statically trace the specifier. See packages/push/src/transports/_lazy.ts
 * for the full reasoning.
 */
const importer = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<unknown>;

export function dynamicImport(specifier: string): Promise<unknown> {
  return importer(specifier);
}
