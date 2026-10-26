import {
  DEFAULT_PROJECT_LIMITS,
  type ProjectLimits,
} from "@/features/project/rules/projectLimits";
import {
  CURRENT_PROJECT_FORMAT_VERSION,
  DEFAULT_PROJECT_NAME,
  PROJECT_FILE_FORMAT,
  type LayoutryProject,
  type ProjectMetadata,
} from "@/features/project/types/projectFile";
import { toCanonicalJsonValue } from "@/features/project/utils/canonicalJson";
import { checkDocumentIntegrity } from "@/features/project/utils/checkDocumentIntegrity";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";

export class ProjectSerializationError extends Error {
  constructor(
    message: string,
    readonly path?: string,
  ) {
    super(message);
    this.name = "ProjectSerializationError";
  }
}

/**
 * A random RFC 4122 v4 UUID. crypto.randomUUID exists only in secure
 * contexts (https, localhost, the desktop app:// origin), so plain-http
 * deployments fall back to crypto.getRandomValues, which is everywhere.
 */
export function generateProjectId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Metadata for a brand-new project. `now`/`id` are injectable for tests. */
export function createProjectMetadata(
  options: { name?: string; now?: Date; id?: string } = {},
): ProjectMetadata {
  const timestamp = (options.now ?? new Date()).toISOString();
  return {
    id: options.id ?? generateProjectId(),
    name: options.name ?? DEFAULT_PROJECT_NAME,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Returns a copy with `updatedAt` set — serialization itself never changes timestamps. */
export function touchProjectMetadata(
  metadata: ProjectMetadata,
  now: Date = new Date(),
): ProjectMetadata {
  return { ...metadata, updatedAt: now.toISOString() };
}

/**
 * Serializes a project to canonical `.layoutry` JSON. Pure: never mutates
 * its input, never regenerates ids, never changes timestamps.
 *
 * It refuses to produce a file this build could not load back: the
 * document's integrity is checked first (safe on cyclic in-memory input),
 * and the finished text is run through the real loader before it is
 * returned. A failure throws ProjectSerializationError — callers should
 * treat that as a bug, since editor-produced documents always pass.
 */
export function serializeProject(
  project: LayoutryProject,
  limits: ProjectLimits = DEFAULT_PROJECT_LIMITS,
): string {
  const integrityError = checkDocumentIntegrity(project.document, limits);
  if (integrityError)
    throw new ProjectSerializationError(
      integrityError.message,
      integrityError.path,
    );

  let body: unknown;
  try {
    body = {
      format: PROJECT_FILE_FORMAT,
      formatVersion: CURRENT_PROJECT_FORMAT_VERSION,
      project: toCanonicalJsonValue(project.metadata, "project"),
      document: toCanonicalJsonValue(project.document, "document"),
    };
  } catch (error) {
    throw new ProjectSerializationError(
      error instanceof Error ? error.message : String(error),
    );
  }

  const text = `${JSON.stringify(body, null, 2)}\n`;
  const check = parseProjectFile(text, limits);
  if (!check.ok)
    throw new ProjectSerializationError(check.error.message, check.error.path);
  return text;
}
