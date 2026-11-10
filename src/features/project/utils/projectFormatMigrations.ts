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

const SPACING_SIDES = ["top", "right", "bottom", "left"] as const;

/**
 * Format 1 → 2 (BC-05.3): spacing zeros become unset sides.
 *
 * Format 1 stored margin and padding as four required numbers and wrote
 * no CSS for a 0, so a 0 there always meant "no declaration": a button
 * with padding 0 still rendered its own default padding. Format 2 makes
 * every side optional and treats 0 as an authored declaration. Reading a
 * format 1 zero as authored would therefore change how old projects look
 * (that button would lose its padding), so this step removes every zero
 * side, and then every box left with no side. Non-zero sides are kept
 * exactly. The spacing record itself is always kept, even when empty,
 * because its presence is what switched off the pre-3.5 container default
 * padding in format 1 and still does in format 2 (elementStyleRecipes).
 * The result renders byte-for-byte the same CSS as before.
 *
 * Only plain-object `spacing.margin` / `spacing.padding` boxes with a
 * numeric 0 are touched; anything malformed is left for the format 2
 * schema to reject, as the migration contract requires. Iterative, so
 * nesting depth (already bounded by the structure scan) never matters.
 */
function migrateSpacingZerosToUnset(
  file: Record<string, unknown>,
): Record<string, unknown> {
  const pending: unknown[] = [file.document];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!isPlainObject(node)) continue;
    const spacing = node.spacing;
    if (isPlainObject(spacing)) {
      for (const box of ["margin", "padding"] as const) {
        const edges = spacing[box];
        if (!isPlainObject(edges)) continue;
        for (const side of SPACING_SIDES) {
          if (edges[side] === 0) delete edges[side];
        }
        if (Object.keys(edges).length === 0) delete spacing[box];
      }
    }
    if (Array.isArray(node.children)) pending.push(...node.children);
  }
  return { ...file, formatVersion: 2 };
}

/** Every migration this build knows, oldest first. */
export const PROJECT_FORMAT_MIGRATIONS: readonly FormatMigration[] = [
  { from: 1, migrate: migrateSpacingZerosToUnset },
];

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
