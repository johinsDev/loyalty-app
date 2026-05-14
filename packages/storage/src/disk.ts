import type {
  ListOptions,
  PresignedUpload,
  PutOptions,
  PutSignedUrlOptions,
  StorageBody,
  StorageFile,
  StorageListResult,
  StorageLogLevel,
  StorageLogger,
  StorageProvider,
} from "./types";

export interface StorageDiskOptions {
  name: string;
  provider: StorageProvider;
  /** When true, `getDownloadUrl` returns the public URL (no expiry) instead of a signed one. */
  isPublic?: boolean;
  logger?: StorageLogger;
  logLevel?: StorageLogLevel;
}

/**
 * One logical bucket. Wraps a `StorageProvider` and adds:
 *
 *   - `getDownloadUrl(key)` — picks public vs signed based on the disk's
 *     `isPublic` flag, so call sites don't need to branch.
 *   - Structured logging on every op (via `@loyalty/log`-style logger).
 *
 * Created by `StorageManager.disk(name)` and cached per name.
 */
export class StorageDisk {
  readonly name: string;
  readonly provider: StorageProvider;
  readonly isPublic: boolean;
  readonly #logger?: StorageLogger;
  readonly #logLevel: StorageLogLevel;

  constructor(options: StorageDiskOptions) {
    this.name = options.name;
    this.provider = options.provider;
    this.isPublic = options.isPublic ?? false;
    this.#logger = options.logger;
    this.#logLevel = options.logLevel ?? "info";
  }

  async put(
    key: string,
    body: StorageBody,
    options: PutOptions = {},
  ): Promise<StorageFile> {
    this.#log("info", { key, op: "put", contentType: options.contentType });
    return this.provider.put(key, body, options);
  }

  async putSignedUrl(
    key: string,
    options: PutSignedUrlOptions,
  ): Promise<PresignedUpload> {
    this.#log("info", { key, op: "putSignedUrl", contentType: options.contentType });
    return this.provider.putSignedUrl(key, options);
  }

  async get(key: string): Promise<{ body: Uint8Array; file: StorageFile }> {
    this.#log("info", { key, op: "get" });
    return this.provider.get(key);
  }

  /**
   * Returns the URL the browser should hit to read the file. Picks
   * the public URL when the disk is public; otherwise mints a signed
   * one with the requested TTL (defaults to 5 minutes).
   */
  async getDownloadUrl(key: string, expiresIn?: number): Promise<string> {
    if (this.isPublic) {
      const url = this.provider.getPublicUrl(key);
      if (!url) {
        throw new Error(
          `disk "${this.name}" is marked public but provider "${this.provider.name}" returned no public URL — set publicUrl on the disk config`,
        );
      }
      return url;
    }
    return this.provider.getSignedUrl(key, expiresIn ?? 300);
  }

  async delete(key: string): Promise<void> {
    this.#log("info", { key, op: "delete" });
    return this.provider.delete(key);
  }

  async list(options?: ListOptions): Promise<StorageListResult> {
    return this.provider.list(options);
  }

  async head(key: string): Promise<StorageFile | null> {
    return this.provider.head(key);
  }

  #log(
    level: "info" | "warn",
    bindings: Record<string, unknown>,
    msg?: string,
  ): void {
    if (this.#logLevel === "silent") return;
    if (this.#logger) {
      const fn = level === "warn" ? this.#logger.warn : this.#logger.info;
      fn.call(
        this.#logger,
        { ...bindings, _service: "storage", disk: this.name, provider: this.provider.name },
        msg ?? "storage.op",
      );
      return;
    }
    // eslint-disable-next-line no-console
    console.log("[storage]", msg ?? "op", { disk: this.name, ...bindings });
  }
}
