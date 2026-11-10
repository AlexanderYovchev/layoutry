import { describe, expect, it } from "vitest";
import { CURRENT_PROJECT_FORMAT_VERSION } from "@/features/project/types/projectFile";
import {
  migrateProjectFile,
  PROJECT_FORMAT_MIGRATIONS,
  type FormatMigration,
} from "@/features/project/utils/projectFormatMigrations";

/**
 * PROJECT-1.5 migration harness: these tests run the dispatcher with
 * synthetic versions to pin the contract every migration relies on (the
 * synthetic files are plain objects). The real format 1 → 2 step
 * (BC-05.3) is tested at the end.
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
  it("passes a current-format file through untouched", () => {
    const file = { format: "layoutry-project", formatVersion: 2, x: 1 };
    expect(CURRENT_PROJECT_FORMAT_VERSION).toBe(2);
    expect(PROJECT_FORMAT_MIGRATIONS.map((step) => step.from)).toEqual([1]);
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

describe("format 1 → 2: spacing zeros become unset (BC-05.3)", () => {
  function v1(document: Record<string, unknown>) {
    return {
      format: "layoutry-project",
      formatVersion: 1,
      project: { id: "p" },
      document,
    };
  }
  function migrated(document: Record<string, unknown>) {
    const result = migrateProjectFile(v1(document));
    if (!result.ok) throw new Error(result.error.message);
    return result.value as {
      formatVersion: number;
      document: Record<string, unknown>;
    };
  }

  it("drops zero sides, keeps non-zero sides exactly, and sets format 2", () => {
    const result = migrated({
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "b",
          tag: "button",
          spacing: {
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 0, right: 12, bottom: 0, left: 4.5 },
          },
        },
      ],
    });
    expect(result.formatVersion).toBe(2);
    expect(result.document).toEqual({
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "b",
          tag: "button",
          spacing: { padding: { right: 12, left: 4.5 } },
        },
      ],
    });
  });

  it("keeps an all-zero spacing record as an empty record (it switched the container default padding off)", () => {
    const result = migrated({
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "c",
          tag: "div",
          spacing: {
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
      ],
    });
    expect((result.document.children as Record<string, unknown>[])[0]).toEqual({
      id: "c",
      tag: "div",
      spacing: {},
    });
  });

  it("reaches nodes at every depth and leaves nodes without spacing alone", () => {
    const deep = {
      id: "d",
      tag: "p",
      spacing: {
        margin: { top: 0, right: 0, bottom: 8, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const result = migrated({
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "a",
          tag: "div",
          children: [{ id: "b", tag: "section", children: [deep] }],
        },
        { id: "e", tag: "h1" },
      ],
    });
    const [outer, plain] = result.document.children as Record<
      string,
      unknown
    >[];
    const inner = (outer.children as Record<string, unknown>[])[0];
    expect((inner.children as Record<string, unknown>[])[0]).toEqual({
      id: "d",
      tag: "p",
      spacing: { margin: { bottom: 8 } },
    });
    expect(outer).not.toHaveProperty("spacing");
    expect(plain).toEqual({ id: "e", tag: "h1" });
  });

  it("leaves malformed spacing for the schema to reject rather than guessing", () => {
    const result = migrated({
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "x",
          tag: "div",
          spacing: { margin: "wide", padding: { top: "0" } },
        },
      ],
    });
    expect((result.document.children as Record<string, unknown>[])[0]).toEqual({
      id: "x",
      tag: "div",
      spacing: { margin: "wide", padding: { top: "0" } },
    });
  });

  it("never modifies the caller's object", () => {
    const original = v1({
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "b",
          tag: "button",
          spacing: {
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
      ],
    });
    const snapshot = structuredClone(original);
    migrateProjectFile(original);
    expect(original).toEqual(snapshot);
  });
});
