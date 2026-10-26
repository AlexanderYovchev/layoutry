import type { z } from "zod";
import {
  DEFAULT_PROJECT_LIMITS,
  type ProjectLimits,
} from "@/features/project/rules/projectLimits";
import { projectFileV1Schema } from "@/features/project/schemas/projectFileSchema";
import {
  CURRENT_PROJECT_FORMAT_VERSION,
  PROJECT_FILE_FORMAT,
  type ProjectLoadError,
  type ProjectLoadResult,
} from "@/features/project/types/projectFile";
import { checkDocumentIntegrity } from "@/features/project/utils/checkDocumentIntegrity";
import { scanJsonStructure } from "@/features/project/utils/scanJsonStructure";

/**
 * Loads a project file from untrusted text. Pure: never throws on bad
 * input, never touches editor state, and returns either a fully validated
 * project or a single user-presentable error — never a partial document.
 *
 * Pipeline: size limit → JSON.parse → iterative structure scan (depth,
 * size, prototype keys) → format identification → version dispatch →
 * strict schema → document integrity. The returned objects are fresh
 * copies built by the schema; nothing aliases the input.
 */
export function parseProjectFile(
  text: string,
  limits: ProjectLimits = DEFAULT_PROJECT_LIMITS,
): ProjectLoadResult {
  const fail = (error: ProjectLoadError): ProjectLoadResult => ({
    ok: false,
    error,
  });

  if (text.length > limits.maxFileCharacters) {
    return fail({
      code: "too-large",
      message: `The project file is larger than ${limits.maxFileCharacters} characters.`,
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail({
      code: "invalid-json",
      message: "The file is not valid JSON.",
    });
  }

  const structureError = scanJsonStructure(raw, limits);
  if (structureError) return fail(structureError);

  if (
    raw === null ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Reflect.get(raw, "format") !== PROJECT_FILE_FORMAT
  ) {
    return fail({
      code: "not-a-project",
      message: "The file is not a Layoutry project.",
    });
  }

  const migrated = migrateToCurrentVersion(raw);
  if (!migrated.ok) return fail(migrated.error);

  const parsed = projectFileV1Schema.safeParse(migrated.value);
  if (!parsed.success) return fail(describeSchemaError(parsed.error));

  const integrityError = checkDocumentIntegrity(parsed.data.document, limits);
  if (integrityError) return fail(integrityError);

  return {
    ok: true,
    project: { metadata: parsed.data.project, document: parsed.data.document },
  };
}

/**
 * The version dispatcher. Format versions are integers; each future
 * version adds a case that upgrades the previous version's raw object one
 * step (v1 → v2 → …) and must carry every authored field forward — a
 * migration may never drop content it does not understand. Files newer
 * than this build are refused (never "best-effort" loaded), because
 * silently ignoring their new fields would lose data on the next save.
 */
function migrateToCurrentVersion(
  raw: object,
): { ok: true; value: unknown } | { ok: false; error: ProjectLoadError } {
  const version: unknown = Reflect.get(raw, "formatVersion");
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return {
      ok: false,
      error: {
        code: "not-a-project",
        message: "The project file has no valid format version.",
        path: "formatVersion",
      },
    };
  }
  if (version > CURRENT_PROJECT_FORMAT_VERSION) {
    return {
      ok: false,
      error: {
        code: "unsupported-version",
        message: `This project was saved by a newer version of Layoutry (format ${version}). Update Layoutry to open it.`,
        path: "formatVersion",
      },
    };
  }
  switch (version) {
    case 1:
      return { ok: true, value: raw };
    default:
      return {
        ok: false,
        error: {
          code: "unsupported-version",
          message: `Project format ${version} is no longer supported.`,
          path: "formatVersion",
        },
      };
  }
}

function describeSchemaError(error: z.ZodError): ProjectLoadError {
  const issue = error.issues[0];
  const path = issue.path
    .map((segment, index) =>
      typeof segment === "number"
        ? `[${segment}]`
        : `${index === 0 ? "" : "."}${String(segment)}`,
    )
    .join("");
  return {
    code: "invalid-structure",
    message: `The project file is damaged or invalid${path ? ` at ${path}` : ""}: ${issue.message}`,
    path: path || undefined,
  };
}
