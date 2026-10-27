import { describe, expect, it } from "vitest";
import { CURRENT_PROJECT_FORMAT_VERSION } from "@/features/project/types/projectFile";
import {
  migrateProjectFile,
  PROJECT_FORMAT_MIGRATIONS,
  type FormatMigration,
} from "@/features/project/utils/projectFormatMigrations";

/**
 * PROJECT-1.5 migration harness. The real chain is empty (format 1 is the
 * only format); these tests run the dispatcher with synthetic versions to
 * pin the contract every future migration will rely on. No v2 field is
 * invented here — the synthetic files are plain objects.
 */

const v1to2: FormatMigration = {
  from: 1,
  migrate: (file) => ({ ...file, formatVersion: 2, added: "in 2" }),
};
const v2to3: FormatMigration = {
  from: 2,
  migrate: ({ added, ...rest }) => ({
    ...rest,
    formatVersion: 3,
    renamed: added,
  }),
};
const chain = {
  currentVersion: 3,
  oldestVersion: 1,
  migrations: [v1to2, v2to3],
};

describe("migrateProjectFile", () => {
  it("passes a current-format file through untouched (the only real case today)", () => {
    const file = { format: "layoutry-project", formatVersion: 1, x: 1 };
    expect(CURRENT_PROJECT_FORMAT_VERSION).toBe(1);
    expect(PROJECT_FORMAT_MIGRATIONS).toEqual([]);
    expect(migrateProjectFile(file)).toEqual({ ok: true, value: file });
  });

  it("upgrades one step at a time, from any older version", () => {
    expect(migrateProjectFile({ formatVersion: 1, keep: "me" }, chain)).toEqual(
      {
        ok: true,
        value: { formatVersion: 3, keep: "me", renamed: "in 2" },
      },
    );
    expect(
      migrateProjectFile({ formatVersion: 2, keep: "me", added: "x" }, chain),
    ).toEqual({
      ok: true,
      value: { formatVersion: 3, keep: "me", renamed: "x" },
    });
  });

  it("never modifies the caller's object, even when a migration mutates its input", () => {
    const original = { formatVersion: 1, nested: { list: [1, 2] } };
    const snapshot = structuredClone(original);
    const mutating: FormatMigration = {
      from: 1,
      migrate: (file) => {
        Reflect.set(file, "formatVersion", 2);
        Reflect.deleteProperty(file, "nested");
        return file;
      },
    };
    const result = migrateProjectFile(original, {
      currentVersion: 2,
      oldestVersion: 1,
      migrations: [mutating],
    });
    expect(result.ok).toBe(true);
    expect(original).toEqual(snapshot);
  });

  it("fails safely, with no partial result, when a migration throws", () => {
    const result = migrateProjectFile(
      { formatVersion: 1 },
      {
        ...chain,
        migrations: [
          v1to2,
          {
            from: 2,
            migrate: () => {
              throw new Error("unknown layout mode");
            },
          },
        ],
      },
    );
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "migration-failed" }),
    });
    if (!result.ok) {
      expect(result.error.message).toMatch(/unknown layout mode/);
      expect(result.error.message).toMatch(/was not changed/);
    }
  });

  it("rejects a migration that doesn't produce the next version", () => {
    const sloppy: FormatMigration = {
      from: 1,
      migrate: (file) => ({ ...file }),
    };
    const result = migrateProjectFile(
      { formatVersion: 1 },
      { currentVersion: 2, oldestVersion: 1, migrations: [sloppy] },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("migration-failed");
  });

  it("treats a gap in the chain as unsupported instead of skipping a step", () => {
    const result = migrateProjectFile(
      { formatVersion: 1 },
      { currentVersion: 3, oldestVersion: 1, migrations: [v2to3] },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unsupported-version");
  });

  it("refuses formats newer than this build and older than it still supports", () => {
    const newer = migrateProjectFile({ formatVersion: 4 }, chain);
    const older = migrateProjectFile(
      { formatVersion: 1 },
      { ...chain, oldestVersion: 2 },
    );
    expect(newer.ok || newer.error.message).toMatch(
      /newer version of Layoutry/,
    );
    expect(older.ok || older.error.message).toMatch(/no longer supported/);
  });

  it.each([0, -1, 1.5, "1", null, undefined])(
    "refuses an invalid format version (%s)",
    (formatVersion) => {
      const result = migrateProjectFile({ formatVersion }, chain);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("not-a-project");
    },
  );
});
