import {
  CURRENT_PROJECT_FORMAT_REVISION,
  CURRENT_PROJECT_FORMAT_VERSION,
  REVISIONED_FORMAT_VERSION,
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

/** The element fields format 3 added (BC-09.2). No format 1 or 2 file can contain them. */
export const FORMAT_3_ELEMENT_FIELDS = [
  "ariaLabel",
  "ariaCurrent",
  "disabled",
  "component",
] as const;

/**
 * Format 2 → 3 (BC-09.2): accessibility fields and component markers.
 *
 * Format 3 only ADDS optional element fields, so every format 2 document
 * is already a valid format 3 document with the same meaning: nothing is
 * rewritten, no id changes, and existing Paginations are NOT turned into
 * the new component (they have no marker and keep their buttons).
 *
 * The one check: an older file must not already contain a format 3
 * field. A format 2 build could never have written one, so such a file is
 * hand-edited or forged, and accepting it would let a file claim an old
 * version to skip the first-save upgrade prompt while carrying new data.
 * It throws, which fails the load with `migration-failed` and leaves the
 * file untouched. Iterative, like the 1 → 2 step.
 */
function migrateToAccessibilityFields(
  file: Record<string, unknown>,
): Record<string, unknown> {
  const pending: unknown[] = [file.document];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!isPlainObject(node)) continue;
    for (const field of FORMAT_3_ELEMENT_FIELDS) {
      if (Object.hasOwn(node, field))
        throw new Error(
          `the file claims an older format but contains "${field}", which only format 3 has`,
        );
    }
    if (Array.isArray(node.children)) pending.push(...node.children);
  }
  return { ...file, formatVersion: 3 };
}

/** The element fields format 4 revision 0 added (BC-17.2). No format 1–3 file can contain them. */
export const FORMAT_4_ELEMENT_FIELDS = [
  "styleRules",
  "styleAssets",
  "outline",
  "counters",
  "logicalSize",
  "dir",
  "progressVariant",
  "progressSegments",
  "progressLabel",
] as const;

/** The fields format 4 added inside existing groups (P-2 logical twins and direction). */
export const FORMAT_4_GROUP_FIELDS: readonly (readonly [
  group: string,
  field: string,
])[] = [
  ["spacing", "marginLogical"],
  ["spacing", "paddingLogical"],
  ["position", "insetLogical"],
  ["border", "borderLogical"],
  ["borderRadius", "radiusLogical"],
  ["typography", "direction"],
  ["typography", "unicodeBidi"],
  ["typography", "writingMode"],
  ["typography", "textOrientation"],
];

/**
 * Format 3 → 4 (BC-17.2): the styling foundation.
 *
 * Format 4 revision 0 only ADDS optional fields (style rules, assets,
 * outline, counters, logical twins, direction, Progress variant data), so
 * every format 3 document is already a valid format 4 document with the
 * same meaning: nothing is rewritten, no id changes, no default is
 * inserted, no physical value becomes logical. Only the version metadata
 * changes: formatVersion 4 and formatRevision 0.
 *
 * The one check, as for 2 → 3: an older file must not already contain a
 * format 4 field or a formatRevision. An older build could never have
 * written one, so such a file is forged or hand-edited, and accepting it
 * would let it skip the first-save upgrade prompt while carrying new
 * data. It throws: the load fails with `migration-failed` and the file is
 * untouched. Iterative.
 */
function migrateToStylingFoundation(
  file: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.hasOwn(file, "formatRevision"))
    throw new Error(
      'the file claims an older format but contains "formatRevision", which only format 4 has',
    );
  const pending: unknown[] = [file.document];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!isPlainObject(node)) continue;
    for (const field of FORMAT_4_ELEMENT_FIELDS) {
      if (Object.hasOwn(node, field))
        throw new Error(
          `the file claims an older format but contains "${field}", which only format 4 has`,
        );
    }
    for (const [group, field] of FORMAT_4_GROUP_FIELDS) {
      const settings = node[group];
      if (isPlainObject(settings) && Object.hasOwn(settings, field))
        throw new Error(
          `the file claims an older format but contains "${group}.${field}", which only format 4 has`,
        );
    }
    if (Array.isArray(node.children)) pending.push(...node.children);
  }
  return { ...file, formatVersion: 4, formatRevision: 0 };
}

/** Every format-version migration this build knows, oldest first. */
export const PROJECT_FORMAT_MIGRATIONS: readonly FormatMigration[] = [
  { from: 1, migrate: migrateSpacingZerosToUnset },
  { from: 2, migrate: migrateToAccessibilityFields },
  { from: 3, migrate: migrateToStylingFoundation },
];

/**
 * One schema revision step inside a revisioned format version: from
 * revision `from` to `from + 1`, returning the file with
 * `formatRevision` set to `from + 1` (and the same formatVersion). The
 * same contract as FormatMigration: carry everything forward, pure,
 * throw rather than guess, validation afterwards.
 */
export interface RevisionMigration {
  from: number;
  migrate: (file: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Every format 4 revision step this build knows, oldest first. Empty at
 * revision 0: later BC-17 checkpoints register (4,0)→(4,1), (4,1)→(4,2), …
 * here, each with its own frozen fixtures.
 */
export const PROJECT_REVISION_MIGRATIONS: readonly RevisionMigration[] = [];

/** The oldest format this build still opens. */
export const OLDEST_SUPPORTED_FORMAT_VERSION = 1;

export interface MigrationOptions {
  currentVersion: number;
  oldestVersion: number;
  migrations: readonly FormatMigration[];
  /**
   * Revisions inside one format version (BC-17.2). Applied when the file
   * reaches `formatVersion`; omitted for chains that have no revisions.
   */
  revisions?: {
    formatVersion: number;
    currentRevision: number;
    migrations: readonly RevisionMigration[];
  };
}

const DEFAULT_OPTIONS: MigrationOptions = {
  currentVersion: CURRENT_PROJECT_FORMAT_VERSION,
  oldestVersion: OLDEST_SUPPORTED_FORMAT_VERSION,
  migrations: PROJECT_FORMAT_MIGRATIONS,
  revisions: {
    formatVersion: REVISIONED_FORMAT_VERSION,
    currentRevision: CURRENT_PROJECT_FORMAT_REVISION,
    migrations: PROJECT_REVISION_MIGRATIONS,
  },
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

  // BC-17.2: a file already in a revisioned version must carry a valid
  // revision, and one newer than this build is refused (never stripped).
  const revisions = options.revisions;
  const revisioned =
    revisions !== undefined && version === revisions.formatVersion;
  let revision = 0;
  if (revisioned) {
    const value: unknown = Reflect.get(raw, "formatRevision");
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
      return {
        ok: false,
        error: {
          code: "invalid-structure",
          message:
            "The project file has no valid format revision (a whole number, 0 or more).",
          path: "formatRevision",
        },
      };
    if (value > revisions.currentRevision)
      return {
        ok: false,
        error: {
          code: "unsupported-version",
          message: `This project was saved by a newer version of Layoutry (format ${version}, revision ${value}). Update Layoutry to open it.`,
          path: "formatRevision",
        },
      };
    revision = value;
  }
  if (
    version === options.currentVersion &&
    (!revisioned || revision === revisions.currentRevision)
  )
    return { ok: true, value: raw };

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
  return applyRevisionSteps(file, version, options);
}

/**
 * Brings a file that has reached the revisioned version to the current
 * revision, one registered step at a time. A missing step is a gap
 * (refused, never skipped); a step that throws or doesn't produce the
 * next revision fails the load without touching the file.
 */
function applyRevisionSteps(
  migrated: unknown,
  originalVersion: number,
  options: MigrationOptions,
): { ok: true; value: unknown } | { ok: false; error: ProjectLoadError } {
  const revisions = options.revisions;
  if (
    revisions === undefined ||
    options.currentVersion !== revisions.formatVersion ||
    !isPlainObject(migrated)
  )
    return { ok: true, value: migrated };
  let file: Record<string, unknown> = migrated;
  const start = file.formatRevision;
  if (typeof start !== "number" || !Number.isInteger(start) || start < 0)
    return migrationFailed(
      originalVersion,
      new Error(`format ${revisions.formatVersion} has no format revision`),
    );
  for (let step = start; step < revisions.currentRevision; step += 1) {
    const migration = revisions.migrations.find(
      (candidate) => candidate.from === step,
    );
    if (!migration)
      return {
        ok: false,
        error: {
          code: "unsupported-version",
          message: `Project format ${revisions.formatVersion} revision ${step} is no longer supported.`,
          path: "formatRevision",
        },
      };
    let next: Record<string, unknown>;
    try {
      next = migration.migrate(file);
    } catch (error) {
      return migrationFailed(originalVersion, error);
    }
    if (
      !isPlainObject(next) ||
      next.formatVersion !== revisions.formatVersion ||
      next.formatRevision !== step + 1
    )
      return migrationFailed(
        originalVersion,
        new Error(
          `revision ${step} → ${step + 1} produced no revision ${step + 1} file`,
        ),
      );
    file = next;
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
