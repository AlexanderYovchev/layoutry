// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { StyleRule } from "@/features/editor/types/styleRules";
import type { ProjectLoadErrorCode } from "@/features/project/types/projectFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import {
  FORMAT_4_ELEMENT_FIELDS,
  FORMAT_4_GROUP_FIELDS,
  migrateProjectFile,
  type RevisionMigration,
} from "@/features/project/utils/projectFormatMigrations";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";

/**
 * BC-17.2 — project format 4 revision 0: the styling foundation. Every
 * case goes through the real loader (size → JSON → structure scan →
 * migration → strict schema → integrity), so these are the guarantees a
 * file actually gets.
 */

const metadata = createProjectMetadata({
  id: "project-1",
  now: new Date("2026-11-26T00:00:00.000Z"),
});

/** A current-format file text with the given document (bypassing serializeProject's own checks). */
function v4(document: unknown, envelope: Record<string, unknown> = {}): string {
  const base: Record<string, unknown> = JSON.parse(
    serializeProject({ metadata, document: pageWith() }),
  );
  return JSON.stringify({ ...base, ...envelope, document });
}

/** An older-format file text (no formatRevision). */
function older(document: unknown, formatVersion: number): string {
  const { formatRevision, ...base }: Record<string, unknown> = JSON.parse(
    serializeProject({ metadata, document: pageWith() }),
  );
  void formatRevision;
  return JSON.stringify({ ...base, formatVersion, document });
}

function accepted(text: string): EditorElementNode {
  const result = parseProjectFile(text);
  if (!result.ok)
    throw new Error(
      `${result.error.code}: ${result.error.message} (${result.error.path})`,
    );
  return result.project.document;
}

function rejected(text: string, code: ProjectLoadErrorCode) {
  const result = parseProjectFile(text);
  if (result.ok) throw new Error("accepted");
  expect(result.error.code).toBe(code);
  return result.error;
}

const button = (extra: Partial<EditorElementNode> = {}): EditorElementNode => ({
  id: "button-1",
  tag: "button",
  text: "Go",
  ...extra,
});
const hover = (extra: Partial<StyleRule> = {}): StyleRule => ({
  id: "rule-1",
  target: "element",
  condition: { self: ["hover"] },
  groups: { background: { color: "#1d4ed8" } },
  ...extra,
});
const steps = { counters: [{ id: "counter-steps", name: "Steps" }] };

describe("format 4 revision 0 envelope", () => {
  it("is what this build writes, and round-trips a fully styled document exactly", () => {
    const document: EditorElementNode = {
      ...pageWith(
        button({
          styleRules: [
            hover(),
            {
              id: "rule-2",
              target: "element",
              condition: { self: ["focus-visible"] },
              groups: {
                outline: {
                  width: { value: 2, unit: "px" },
                  style: "solid",
                  color: "#93c5fd",
                  offset: { value: 2, unit: "px" },
                },
              },
            },
            {
              id: "rule-3",
              target: "element",
              condition: { self: ["disabled"] },
              groups: { display: { cursor: "not-allowed" } },
            },
            {
              id: "rule-4",
              target: "after",
              condition: {},
              content: {
                kind: "parts",
                parts: [
                  { kind: "text", text: "Step " },
                  {
                    kind: "counter",
                    counter: { kind: "document", id: "counter-steps" },
                    style: { kind: "predefined", style: "decimal" },
                  },
                ],
                altText: "",
              },
              groups: { spacing: { marginLogical: { inlineStart: 6 } } },
            },
            {
              id: "rule-5",
              target: "element",
              condition: {
                ancestor: { scope: { kind: "parent" }, atom: "hover" },
              },
              groups: { transform: { scale: 1.05 } },
            },
          ],
          counters: {
            increment: [{ counter: { kind: "document", id: "counter-steps" } }],
          },
          outline: { style: "auto" },
          logicalSize: { inlineSize: { value: 12, unit: "rem" } },
          dir: "rtl",
          typography: {
            direction: "rtl",
            writingMode: "horizontal-tb",
            unicodeBidi: "isolate",
            textOrientation: "mixed",
          },
          spacing: { margin: { top: 4 }, paddingLogical: { blockStart: 8 } },
          position: {
            position: "relative",
            insetLogical: { inlineStart: { value: 1, unit: "px" } },
          },
          border: {
            top: { style: "solid" },
            borderLogical: { inlineEnd: { width: { value: 1, unit: "px" } } },
          },
          borderRadius: {
            topLeft: { value: 4, unit: "px" },
            radiusLogical: { endEnd: { value: 8, unit: "px" } },
          },
        }),
        {
          id: "progress-1",
          tag: "progress",
          progressValue: 40,
          progressVariant: "custom",
          progressSegments: { count: 10, gap: { value: 2, unit: "px" } },
          progressLabel: {
            kind: "template",
            template: "{value} of {max} ({percent}) {{done}}",
            percentFormat: {
              fractionDigits: 1,
              trailingZeros: "trim",
              grouping: true,
            },
            valueFormat: {
              fractionDigits: 0,
              trailingZeros: "keep",
              grouping: false,
            },
            locale: { kind: "tag", tag: "de-CH" },
            indeterminateText: "Loading",
          },
        },
      ),
      styleAssets: {
        ...steps,
        keyframes: [
          {
            id: "kf-1",
            name: "Pulse",
            stops: [
              { offset: 0, groups: { filters: { opacity: 1 } } },
              { offset: 100, groups: { filters: { opacity: 0.5 } } },
            ],
          },
        ],
        presets: [
          {
            id: "preset-1",
            library: "project",
            name: "Numbered step",
            kind: "element",
            payload: {
              groups: {
                counters: {
                  increment: [{ counter: { kind: "document", id: "c-local" } }],
                },
              },
              counters: [{ id: "c-local", name: "Steps" }],
            },
            createdAt: "2026-11-26T00:00:00.000Z",
            updatedAt: "2026-11-26T00:00:00.000Z",
          },
        ],
      },
    };
    const text = serializeProject({ metadata, document });
    expect(JSON.parse(text)).toMatchObject({
      formatVersion: 4,
      formatRevision: 0,
    });
    expect(Object.keys(JSON.parse(text))).toEqual([
      "format",
      "formatVersion",
      "formatRevision",
      "project",
      "document",
    ]);
    expect(accepted(text)).toEqual(document);
    expect(serializeProject({ metadata, document: accepted(text) })).toBe(text);
  });

  it.each([
    ["missing", undefined],
    ["negative", -1],
    ["fractional", 0.5],
    ["a string", "0"],
    ["null", null],
  ])(
    "refuses a format 4 file whose revision is %s",
    (_label, formatRevision) => {
      const error = rejected(
        v4(pageWith(), { formatRevision }),
        "invalid-structure",
      );
      expect(error.path).toBe("formatRevision");
    },
  );

  it("refuses a newer revision (never strips it) and a newer format version", () => {
    expect(
      rejected(v4(pageWith(), { formatRevision: 1 }), "unsupported-version")
        .message,
    ).toMatch(/newer version of Layoutry \(format 4, revision 1\)/);
    expect(
      rejected(v4(pageWith(), { formatVersion: 5 }), "unsupported-version")
        .message,
    ).toMatch(/newer version of Layoutry \(format 5\)/);
  });

  it("refuses an unknown future field anywhere in the new data rather than dropping it", () => {
    rejected(
      v4(
        pageWith(
          button({
            styleRules: [{ ...hover(), selector: ".x:hover" } as StyleRule],
          }),
        ),
      ),
      "invalid-structure",
    );
    rejected(
      v4({ ...pageWith(), styleAssets: { tokens: [] } }),
      "invalid-structure",
    );
    rejected(
      v4(
        pageWith(
          button({
            counters: {
              reset: [
                { counter: { kind: "document", id: "c" }, value: 1, raw: "x" },
              ],
            } as never,
          }),
        ),
      ),
      "invalid-structure",
    );
  });
});

describe("format 3 → 4 migration (identity apart from version metadata)", () => {
  it("adds only formatVersion 4 and formatRevision 0, and inserts no defaults", () => {
    const document = pageWith(
      button({
        spacing: { padding: { top: 4 } },
        typography: { textAlign: "left" },
      }),
      { id: "progress-1", tag: "progress", progressValue: 3 },
    );
    const raw = JSON.parse(older(document, 3));
    const result = migrateProjectFile(raw);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toEqual({
      ...raw,
      formatVersion: 4,
      formatRevision: 0,
    });
    expect(raw.formatVersion).toBe(3);
    expect(accepted(older(document, 3))).toEqual(document);
  });

  it.each(FORMAT_4_ELEMENT_FIELDS)(
    "refuses a format 3 file that already contains the format 4 field %s",
    (field) => {
      const error = rejected(
        older(pageWith(button({ [field]: {} } as never)), 3),
        "migration-failed",
      );
      expect(error.message).toContain(`"${field}"`);
      expect(error.message).toMatch(/The file itself was not changed/);
    },
  );

  it.each(
    FORMAT_4_GROUP_FIELDS.map(
      ([group, field]) => [`${group}.${field}`, group, field] as const,
    ),
  )("refuses a format 3 file that smuggles %s", (_label, group, field) => {
    const error = rejected(
      older(pageWith(button({ [group]: { [field]: {} } } as never)), 3),
      "migration-failed",
    );
    expect(error.message).toContain(`"${group}.${field}"`);
  });

  it("refuses a format 1–3 file that claims a formatRevision", () => {
    for (const version of [1, 2, 3]) {
      const text = JSON.stringify({
        ...JSON.parse(older(pageWith(), version)),
        formatRevision: 0,
      });
      expect(rejected(text, "migration-failed").message).toContain(
        '"formatRevision"',
      );
    }
  });
});

describe("the revision-step framework (synthetic steps; revision 0 has none)", () => {
  const options = (
    migrations: readonly RevisionMigration[],
    currentRevision = 2,
  ) => ({
    currentVersion: 4,
    oldestVersion: 4,
    migrations: [],
    revisions: { formatVersion: 4, currentRevision, migrations },
  });
  const r0to1: RevisionMigration = {
    from: 0,
    migrate: (file) => ({ ...file, formatRevision: 1, one: true }),
  };
  const r1to2: RevisionMigration = {
    from: 1,
    migrate: (file) => ({ ...file, formatRevision: 2, two: true }),
  };

  it("runs every step from the file's revision, in order, exactly once", () => {
    expect(
      migrateProjectFile(
        { formatVersion: 4, formatRevision: 0 },
        options([r0to1, r1to2]),
      ),
    ).toEqual({
      ok: true,
      value: { formatVersion: 4, formatRevision: 2, one: true, two: true },
    });
    // A file already at revision 1 does not re-run the 0 → 1 step: the revision is the only signal.
    expect(
      migrateProjectFile(
        { formatVersion: 4, formatRevision: 1 },
        options([r0to1, r1to2]),
      ),
    ).toEqual({
      ok: true,
      value: { formatVersion: 4, formatRevision: 2, two: true },
    });
  });

  it("refuses a gap, fails safely on a throwing step, and rejects a step that skips its revision", () => {
    const gap = migrateProjectFile(
      { formatVersion: 4, formatRevision: 0 },
      options([r1to2]),
    );
    expect(gap.ok || gap.error.code).toBe("unsupported-version");
    const throwing = migrateProjectFile(
      { formatVersion: 4, formatRevision: 0 },
      options(
        [
          {
            from: 0,
            migrate: () => {
              throw new Error("boom");
            },
          },
        ],
        1,
      ),
    );
    expect(throwing.ok || throwing.error.code).toBe("migration-failed");
    const sloppy = migrateProjectFile(
      { formatVersion: 4, formatRevision: 0 },
      options(
        [{ from: 0, migrate: (file) => ({ ...file, formatRevision: 2 }) }],
        1,
      ),
    );
    expect(sloppy.ok || sloppy.error.code).toBe("migration-failed");
  });

  it("never modifies the caller's object", () => {
    const original = { formatVersion: 4, formatRevision: 0, nested: { a: 1 } };
    const snapshot = structuredClone(original);
    migrateProjectFile(
      original,
      options(
        [
          {
            from: 0,
            migrate: (file) => {
              Reflect.deleteProperty(file, "nested");
              return { ...file, formatRevision: 1 };
            },
          },
        ],
        1,
      ),
    );
    expect(original).toEqual(snapshot);
  });
});

describe("strict validation of the styling foundation", () => {
  const withRule = (rule: unknown) =>
    v4(pageWith(button({ styleRules: [rule as StyleRule] })));

  it.each([
    ["an unknown target", { ...hover(), target: "::-webkit-anything" }],
    [
      "an unknown state",
      { ...hover(), condition: { self: ["visited-twice"] } },
    ],
    [
      "a duplicate state",
      { ...hover(), condition: { self: ["hover", "hover"] } },
    ],
    [
      "states out of canonical order",
      { ...hover(), condition: { self: ["checked", "hover"] } },
    ],
    ["an empty state list", { ...hover(), condition: { self: [] } }],
    [
      "the element's default state (that is the base)",
      { ...hover(), condition: {} },
    ],
    [
      "an unknown ancestor scope",
      {
        ...hover(),
        condition: {
          ancestor: {
            scope: { kind: "selector", value: ".card" },
            atom: "hover",
          },
        },
      },
    ],
    [
      "an unknown profile scope",
      {
        ...hover(),
        condition: {
          ancestor: {
            scope: { kind: "profile", profile: "card" },
            atom: "hover",
          },
        },
      },
    ],
    ["a rule with nothing in it", { ...hover(), groups: {} }],
    [
      "content on a non-content target",
      {
        ...hover(),
        target: "placeholder",
        condition: {},
        content: { kind: "empty" },
      },
    ],
    [
      "a raw content string",
      { ...hover(), target: "before", condition: {}, content: "attr(data-x)" },
    ],
    [
      "an unknown glyph",
      {
        ...hover(),
        target: "before",
        condition: {},
        content: { kind: "parts", parts: [{ kind: "glyph", glyph: "skull" }] },
      },
    ],
    [
      "empty parts",
      {
        ...hover(),
        target: "before",
        condition: {},
        content: { kind: "parts", parts: [] },
      },
    ],
    [
      "more than 16 parts",
      {
        ...hover(),
        target: "before",
        condition: {},
        content: {
          kind: "parts",
          parts: Array.from({ length: 17 }, () => ({
            kind: "glyph",
            glyph: "dot",
          })),
        },
      },
    ],
    [
      "more than 200 characters of generated text",
      {
        ...hover(),
        target: "before",
        condition: {},
        content: {
          kind: "parts",
          parts: [{ kind: "text", text: "x".repeat(150) }],
          altText: "y".repeat(60),
        },
      },
    ],
    [
      "a control character in generated text",
      {
        ...hover(),
        target: "before",
        condition: {},
        content: { kind: "parts", parts: [{ kind: "text", text: "a\u0000b" }] },
      },
    ],
    [
      "a custom counter style",
      {
        ...hover(),
        target: "before",
        condition: {},
        content: {
          kind: "parts",
          parts: [
            {
              kind: "counter",
              counter: { kind: "builtin", name: "list-item" },
              style: { kind: "custom", id: "x" },
            },
          ],
        },
      },
    ],
    ["an unknown group", { ...hover(), groups: { css: "color: red" } }],
    ["an invalid rule id", { ...hover(), id: "rule 1;" }],
  ])("refuses %s", (_label, rule) => {
    rejected(withRule(rule), "invalid-structure");
  });

  it("accepts every form the architecture defines", () => {
    const rules: StyleRule[] = [
      hover(),
      {
        id: "r-compound",
        target: "element",
        condition: { self: ["hover", "disabled"] },
        groups: { filters: { opacity: 0.5 } },
      },
      {
        id: "r-scope",
        target: "element",
        condition: {
          ancestor: {
            scope: { kind: "profile", profile: "container" },
            atom: "focus-within",
          },
        },
        groups: { filters: { opacity: 0.9 } },
      },
      {
        id: "r-component",
        target: "element",
        condition: {
          ancestor: { scope: { kind: "component" }, atom: "hover" },
        },
        groups: { filters: { opacity: 0.8 } },
      },
      {
        id: "r-empty-content",
        target: "before",
        condition: {},
        content: { kind: "empty" },
        groups: {},
      },
      {
        id: "r-nested",
        target: "marker",
        condition: {},
        content: {
          kind: "parts",
          parts: [
            {
              kind: "counters",
              counter: { kind: "builtin", name: "list-item" },
              separator: ".",
              style: { kind: "predefined", style: "lower-roman" },
            },
            { kind: "glyph", glyph: "middle-dot" },
          ],
        },
        groups: {},
      },
    ];
    expect(
      accepted(v4(pageWith(button({ styleRules: rules })))).children?.[0]
        .styleRules,
    ).toEqual(rules);
  });

  it.each([
    [
      "a non-integer counter value",
      {
        reset: [
          { counter: { kind: "builtin", name: "list-item" }, value: 1.5 },
        ],
      },
    ],
    [
      "an out-of-range counter value",
      {
        set: [
          { counter: { kind: "builtin", name: "list-item" }, value: 1_000_001 },
        ],
      },
    ],
    ["an empty operation list", { increment: [] }],
    [
      "the same counter twice in one list",
      {
        increment: [
          { counter: { kind: "builtin", name: "list-item" } },
          { counter: { kind: "builtin", name: "list-item" }, value: 2 },
        ],
      },
    ],
    [
      "an unknown built-in counter",
      { increment: [{ counter: { kind: "builtin", name: "page" } }] },
    ],
    ["a counter named by a raw string", { increment: [{ counter: "steps" }] }],
  ])("refuses counter operations with %s", (_label, counters) => {
    rejected(
      v4(pageWith(button({ counters: counters as never }))),
      "invalid-structure",
    );
  });

  it("accepts negative and positive steps for several counters on one element", () => {
    const counters = {
      reset: [
        { counter: { kind: "document", id: "a" }, value: 10 },
        { counter: { kind: "document", id: "b" } },
      ],
      increment: [{ counter: { kind: "document", id: "a" }, value: -1 }],
      set: [{ counter: { kind: "document", id: "b" }, value: 0 }],
    } as const;
    const document = {
      ...pageWith(button({ counters: structuredClone(counters) as never })),
      styleAssets: {
        counters: [
          { id: "a", name: "Countdown" },
          { id: "b", name: "Other" },
        ],
      },
    };
    expect(accepted(v4(document)).children?.[0].counters).toEqual(counters);
  });

  it.each([
    ["an unknown direction", { typography: { direction: "auto" } }],
    [
      "a sideways writing mode (not admitted before BC-17.7)",
      { typography: { writingMode: "sideways-rl" } },
    ],
    ["an unknown dir", { dir: "rtl-ish" }],
    [
      "a logical side with a unit object where a number belongs",
      { spacing: { marginLogical: { blockStart: { value: 1, unit: "px" } } } },
    ],
    ["an unknown logical side", { spacing: { marginLogical: { start: 4 } } }],
    ["a logical size as a bare number", { logicalSize: { inlineSize: 100 } }],
    ["an outline style of hidden", { outline: { style: "hidden" } }],
  ])("refuses %s", (_label, fields) => {
    rejected(v4(pageWith(button(fields as never))), "invalid-structure");
  });

  const progress = (extra: Record<string, unknown>) =>
    v4(pageWith({ id: "progress-1", tag: "progress", ...extra } as never));
  const label = (extra: Record<string, unknown> = {}) => ({
    kind: "percent",
    percentFormat: { fractionDigits: 0, trailingZeros: "trim", grouping: true },
    valueFormat: { fractionDigits: 2, trailingZeros: "trim", grouping: true },
    locale: { kind: "neutral" },
    ...extra,
  });

  it.each([
    ["an unknown variant", { progressVariant: "fancy" }],
    [
      "0 segments",
      { progressSegments: { count: 0, gap: { value: 2, unit: "px" } } },
    ],
    [
      "101 segments",
      { progressSegments: { count: 101, gap: { value: 2, unit: "px" } } },
    ],
    [
      "fractional segments",
      { progressSegments: { count: 2.5, gap: { value: 2, unit: "px" } } },
    ],
    [
      "7 fraction digits",
      {
        progressLabel: label({
          percentFormat: {
            fractionDigits: 7,
            trailingZeros: "trim",
            grouping: true,
          },
        }),
      },
    ],
    ["an unknown label kind", { progressLabel: label({ kind: "fraction" }) }],
    [
      "a template label without a template",
      { progressLabel: label({ kind: "template" }) },
    ],
    [
      "a template on a percent label",
      { progressLabel: label({ template: "{percent}" }) },
    ],
    [
      "an unknown token",
      {
        progressLabel: label({
          kind: "template",
          template: "{value} of {total}",
        }),
      },
    ],
    [
      "an unclosed brace",
      { progressLabel: label({ kind: "template", template: "{value" }) },
    ],
    [
      "a lone closing brace",
      { progressLabel: label({ kind: "template", template: "value}" }) },
    ],
    [
      "a double percent sign",
      { progressLabel: label({ kind: "template", template: "{percent}%" }) },
    ],
    [
      "a percent sign before the token",
      { progressLabel: label({ kind: "template", template: "%{percent}" }) },
    ],
    [
      "a script-looking expression",
      { progressLabel: label({ kind: "template", template: "{value * 2}" }) },
    ],
    [
      "a malformed locale tag",
      {
        progressLabel: label({
          locale: { kind: "tag", tag: "english please" },
        }),
      },
    ],
    [
      "an overlong locale tag",
      {
        progressLabel: label({
          locale: { kind: "tag", tag: `en-${"x".repeat(40)}` },
        }),
      },
    ],
    [
      "an overlong indeterminate text",
      { progressLabel: label({ indeterminateText: "x".repeat(61) }) },
    ],
  ])("refuses a Progress with %s", (_label, fields) => {
    rejected(progress(fields), "invalid-structure");
  });

  it("accepts every label kind, literal braces and the supported locale forms, without touching the value", () => {
    for (const progressLabel of [
      label(),
      label({ kind: "none" }),
      label({ kind: "valueMax" }),
      label({ kind: "template", template: "{{{value}}} / {max} · {percent}" }),
      label({ locale: { kind: "tag", tag: "zh-Hant-TW" } }),
      label({ locale: { kind: "tag", tag: "sr-Latn-RS-u-nu-latn" } }),
    ]) {
      const document = accepted(
        progress({ progressValue: 33.333, progressMax: 100, progressLabel }),
      );
      expect(document.children?.[0]).toMatchObject({
        progressValue: 33.333,
        progressMax: 100,
        progressLabel,
      });
    }
  });
});

describe("document integrity of the styling foundation", () => {
  it("refuses duplicate rule ids anywhere in the document", () => {
    const document = pageWith(
      button({ styleRules: [hover()] }),
      button({ id: "button-2", styleRules: [hover()] }),
    );
    expect(rejected(v4(document), "integrity").message).toMatch(
      /Style rule id "rule-1" is used more than once/,
    );
  });

  it("refuses two rules for the same target and canonically equal state", () => {
    const document = pageWith(
      button({ styleRules: [hover(), hover({ id: "rule-2" })] }),
    );
    expect(rejected(v4(document), "integrity").path).toBe(
      "document.children[0].styleRules[1].condition",
    );
    // Different targets or states are separate rules.
    accepted(
      v4(
        pageWith(
          button({
            styleRules: [
              hover(),
              hover({ id: "rule-2", target: "before" }),
              hover({ id: "rule-3", condition: { self: ["active"] } }),
            ],
          }),
        ),
      ),
    );
  });

  it.each([
    [
      "a node's counters",
      button({
        counters: {
          increment: [{ counter: { kind: "document", id: "nope" } }],
        },
      }),
    ],
    [
      "a rule's counters",
      button({
        styleRules: [
          hover({
            target: "before",
            condition: {},
            groups: {
              counters: {
                reset: [{ counter: { kind: "document", id: "nope" } }],
              },
            },
          }),
        ],
      }),
    ],
    [
      "generated content",
      button({
        styleRules: [
          hover({
            target: "before",
            condition: {},
            groups: {},
            content: {
              kind: "parts",
              parts: [
                {
                  kind: "counter",
                  counter: { kind: "document", id: "nope" },
                  style: { kind: "predefined", style: "decimal" },
                },
              ],
            },
          }),
        ],
      }),
    ],
  ])("refuses a dangling counter reference in %s", (_label, node) => {
    expect(
      rejected(v4({ ...pageWith(node), styleAssets: steps }), "integrity")
        .message,
    ).toMatch(/counter "nope", which does not exist/);
  });

  it("refuses duplicate counter ids and names that are equal after normalization", () => {
    rejected(
      v4({
        ...pageWith(),
        styleAssets: {
          counters: [
            { id: "c", name: "A" },
            { id: "c", name: "B" },
          ],
        },
      }),
      "integrity",
    );
    expect(
      rejected(
        v4({
          ...pageWith(),
          styleAssets: {
            counters: [
              { id: "a", name: "Steps" },
              { id: "b", name: "  STEPS " },
            ],
          },
        }),
        "integrity",
      ).message,
    ).toMatch(/used more than once/);
  });

  it("refuses blank or control-character asset names", () => {
    rejected(
      v4({
        ...pageWith(),
        styleAssets: { counters: [{ id: "a", name: "   " }] },
      }),
      "invalid-structure",
    );
    rejected(
      v4({
        ...pageWith(),
        styleAssets: { counters: [{ id: "a", name: "a\nb" }] },
      }),
      "invalid-structure",
    );
    rejected(
      v4({
        ...pageWith(),
        styleAssets: { counters: [{ id: "a", name: "x".repeat(65) }] },
      }),
      "invalid-structure",
    );
  });

  it("refuses styling assets anywhere but the document root", () => {
    expect(
      rejected(
        v4(pageWith({ id: "div-1", tag: "div", styleAssets: steps })),
        "integrity",
      ).path,
    ).toBe("document.children[0].styleAssets");
  });

  it("refuses Progress data on another element", () => {
    expect(
      rejected(v4(pageWith(button({ progressVariant: "custom" }))), "integrity")
        .message,
    ).toMatch(/only allowed on a Progress Bar/);
  });

  it("refuses duplicate keyframe offsets and a preset whose references don't resolve inside it", () => {
    rejected(
      v4({
        ...pageWith(),
        styleAssets: {
          keyframes: [
            {
              id: "k",
              name: "K",
              stops: [
                { offset: 0, groups: {} },
                { offset: 0, groups: {} },
              ],
            },
          ],
        },
      }),
      "invalid-structure",
    );
    const preset = {
      id: "p",
      library: "project",
      name: "P",
      kind: "element",
      payload: {
        groups: {
          counters: {
            increment: [{ counter: { kind: "document", id: "counter-steps" } }],
          },
        },
      },
      createdAt: "2026-11-26T00:00:00.000Z",
      updatedAt: "2026-11-26T00:00:00.000Z",
    };
    // The document defines "counter-steps", but a preset is applied detached, so it must carry its own definitions.
    rejected(
      v4({ ...pageWith(), styleAssets: { ...steps, presets: [preset] } }),
      "integrity",
    );
    rejected(
      v4({
        ...pageWith(),
        styleAssets: { presets: [{ ...preset, library: "app" }] },
      }),
      "invalid-structure",
    );
  });
});

describe("SVG identity contract (unchanged at format 4 revision 0)", () => {
  const svg = (objects: unknown[]) =>
    v4(pageWith({ id: "svg-1", tag: "svg", svgScene: { objects } } as never));
  const path = {
    id: "path-1",
    type: "path",
    commands: [
      { kind: "M", x: 0, y: 0 },
      { kind: "L", x: 10, y: 10 },
      { kind: "Z" },
    ],
  };

  it("keeps existing scenes valid", () => {
    accepted(
      svg([
        path,
        {
          id: "rect-1",
          type: "rect",
          x: 0,
          y: 0,
          width: 5,
          height: 5,
          fill: "#000000",
        },
      ]),
    );
  });

  it.each([
    [
      "a stored anchor id on a path command",
      [{ ...path, commands: [{ kind: "M", x: 0, y: 0, id: "anchor-1" }] }],
    ],
    [
      "stored anchors",
      [{ ...path, anchors: [{ id: "a-1", pointType: "corner" }] }],
    ],
    [
      "a curve command (arrives with BC-17.18)",
      [
        {
          ...path,
          commands: [{ kind: "C", x1: 0, y1: 0, x2: 1, y2: 1, x: 2, y: 2 }],
        },
      ],
    ],
    ["a clip-path reference", [{ ...path, clipPathRef: "#clip-1" }]],
    ["a definition id", [{ ...path, defId: "grad-1" }]],
    ["a mask reference", [{ ...path, mask: { ref: "mask-1" } }]],
    [
      "an object transform (arrives with BC-17.18)",
      [{ ...path, transform: { rotateDeg: 10 } }],
    ],
  ])("refuses %s", (_label, objects) => {
    rejected(svg(objects), "invalid-structure");
  });

  it("still refuses duplicate object ids within one SVG", () => {
    rejected(svg([path, { ...path }]), "integrity");
  });

  it("refuses scene-level definitions (no defs list exists)", () => {
    rejected(
      v4(
        pageWith({
          id: "svg-1",
          tag: "svg",
          svgScene: { objects: [], defs: [] },
        } as never),
      ),
      "invalid-structure",
    );
  });
});
