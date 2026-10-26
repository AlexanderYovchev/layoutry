import { randomBytes } from "node:crypto";
import path from "node:path";
import type { FileFingerprint } from "./projectFileSystem";

/**
 * Opaque capabilities for project files (PROJECT-1.3). The main process
 * keeps every path; the renderer only ever holds a random token it
 * received from a native dialog or a command-line/Explorer open. A token is
 * bound to the window (webContents id) it was issued to, is useless to any
 * other window, and dies with that window.
 */

export const FILE_TOKEN_PATTERN = /^[0-9a-f]{32}$/;
/** Tokens kept per window; the oldest is dropped beyond this. */
const MAX_TOKENS_PER_OWNER = 32;

export interface FileCapability {
  filePath: string;
  fileName: string;
  /**
   * The version this window last read or wrote. `null` for a destination
   * just chosen in the Save dialog and not yet written: the dialog already
   * confirmed replacing whatever is there.
   */
  fingerprint: FileFingerprint | null;
}

export class FileCapabilityRegistry {
  private readonly owners = new Map<number, Map<string, FileCapability>>();

  constructor(
    private readonly createToken: () => string = () =>
      randomBytes(16).toString("hex"),
  ) {}

  issue(
    ownerId: number,
    filePath: string,
    fingerprint: FileFingerprint | null,
  ): string {
    let tokens = this.owners.get(ownerId);
    if (!tokens) {
      tokens = new Map();
      this.owners.set(ownerId, tokens);
    }
    let token = this.createToken();
    while (tokens.has(token)) token = this.createToken();
    tokens.set(token, {
      filePath,
      fileName: path.basename(filePath),
      fingerprint,
    });
    while (tokens.size > MAX_TOKENS_PER_OWNER) {
      const oldest = tokens.keys().next().value;
      if (oldest === undefined) break;
      tokens.delete(oldest);
    }
    return token;
  }

  /** The capability, or null for an unknown, released or foreign token. */
  resolve(ownerId: number, token: string): FileCapability | null {
    if (!FILE_TOKEN_PATTERN.test(token)) return null;
    return this.owners.get(ownerId)?.get(token) ?? null;
  }

  recordVersion(
    ownerId: number,
    token: string,
    fingerprint: FileFingerprint,
  ): void {
    const capability = this.resolve(ownerId, token);
    if (capability) capability.fingerprint = fingerprint;
  }

  release(ownerId: number, token: string): void {
    this.owners.get(ownerId)?.delete(token);
  }

  /** Drops every token of a closed or crashed window. */
  revokeOwner(ownerId: number): void {
    this.owners.delete(ownerId);
  }

  count(ownerId: number): number {
    return this.owners.get(ownerId)?.size ?? 0;
  }
}
