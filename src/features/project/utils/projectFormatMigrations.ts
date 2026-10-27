import {
  CURRENT_PROJECT_FORMAT_VERSION,
  type ProjectLoadError,
} from "@/features/project/types/projectFile";

/**
 * Upgrades a parsed `.layoutry` file object one format version, from
 * `from` to `from + 1`, and returns the upgraded object with its
 * `formatVersion` set to `from + 1`.
 *
 * The migration contract (docs/architecture/project-format.md):
 * - carry every authored field forward — never drop content it doesn't
 *   understand;
 * - be pure and deterministic: no I/O, no clock, no random ids;
 * - throw on input it can't upgrade, rather than guessing;
 * - leave validation to the target version's strict schema, which runs
 *   afterwards exactly as for a file written in that version.
 */
export interface FormatMigration {
  from: number;
  migrate: (file: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Every migration this build knows, oldest first. Empty: format 1 is the
 * only format so far. Format 2 will add `{ from: 1, migrate }` here.
 */
export const PROJECT_FORMAT_MIGRATIONS: readonly FormatMigration[] = [];

/** The oldest format this build still opens. */
export const OLDEST_SUPPORTED_FORMAT_VERSION = 1;

export interface MigrationOptions {
  currentVersion: number;
  oldestVersion: number;
  migrations: readonly FormatMigration[];
}

const DEFAULT_OPTIONS: MigrationOptions = {
  currentVersion: CURRENT_PROJECT_FORMAT_VERSION,
  oldestVersion: OLDEST_SUPPORTED_FORMAT_VERSION,
  migrations: PROJECT_FORMAT_MIGRATIONS,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The version dispatcher (PROJECT-1.1, made a step chain in PROJECT-1.5).
 * Brings a parsed file object to the current format one step at a time.
 *
 * Loading never writes anything, so a failed migration can't touch the
 * file it came from: the open simply fails with a clear error. Files
 * newer than this build are refused (never "best-effort" loaded), because
 * silently ignoring their new fields would lose data on the next save.
 */
export function migrateProjectFile(
  raw: object,
  options: MigrationOptions = DEFAULT_OPTIONS,
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
  if (version > options.currentVersion) {
    return {
      ok: false,
      error: {
        code: "unsupported-version",
        message: `This project was saved by a newer version of Layoutry (format ${version}). Update Layoutry to open it.`,
        path: "formatVersion",
      },
    };
  }
  const noLongerSupported = {
    ok: false as const,
    error: {
      code: "unsupported-version" as const,
      message: `Project format ${version} is no longer supported.`,
      path: "formatVersion",
    },
  };
  if (version < options.oldestVersion) return noLongerSupported;
  if (version === options.currentVersion) return { ok: true, value: raw };

  // The caller's object is never modified, whatever a migration does.
  let file: unknown = structuredClone(raw);
  for (let step = version; step < options.currentVersion; step += 1) {
    const migration = options.migrations.find(
      (candidate) => candidate.from === step,
    );
    if (!migration || !isPlainObject(file)) return noLongerSupported;
    try {
      file = migration.migrate(file);
    } catch (error) {
      return migrationFailed(version, error);
    }
    if (!isPlainObject(file) || file.formatVersion !== step + 1)
      return migrationFailed(
        version,
        new Error(
          `format ${step} → ${step + 1} produced no format ${step + 1} file`,
        ),
      );
  }
  return { ok: true, value: file };
}

function migrationFailed(
  version: number,
  error: unknown,
): { ok: false; error: ProjectLoadError } {
  const detail = error instanceof Error ? ` (${error.message})` : "";
  return {
    ok: false,
    error: {
      code: "migration-failed",
      message: `This project uses an older format (${version}) that Layoutry couldn't upgrade${detail}. The file itself was not changed.`,
      path: "formatVersion",
    },
  };
}
