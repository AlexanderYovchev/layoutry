// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import {
  DEFAULT_PROJECT_LIMITS,
  type ProjectLimits,
} from "@/features/project/rules/projectLimits";
import type { ProjectLoadErrorCode } from "@/features/project/types/projectFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import {
  fixtureDocument,
  nestedDocument,
  pageWith,
} from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";

const metadata = createProjectMetadata({
  id: "project-1",
  now: new Date("2026-10-26T00:00:00.000Z"),
});

/** A valid file as a plain object, ready to be corrupted one way per test. */
function validFile(
  document: EditorElementNode = fixtureDocument,
): Record<string, unknown> {
  return JSON.parse(serializeProject({ metadata, document }));
}

function expectRejected(
  text: string,
  code: ProjectLoadErrorCode,
  limits?: ProjectLimits,
) {
  const result = parseProjectFile(text, limits);
  expect(result.ok, "should be rejected").toBe(false);
  if (result.ok) return undefined;
  expect(result.error.code).toBe(code);
  expect(result.error.message.length).toBeGreaterThan(0);
  return result.error;
}

const withDocument = (document: unknown) =>
  JSON.stringify({ ...validFile(), document });

describe("parseProjectFile — accepts", () => {
  it("a valid current-version file and returns typed metadata and document", () => {
    const result = parseProjectFile(JSON.stringify(validFile()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.metadata).toEqual(metadata);
    expect(result.project.document).toEqual(fixtureDocument);
  });

  it("empty strings for cleared URL fields", () => {
    const file = withDocument(pageWith({ id: "img-1", tag: "img", src: "" }));
    expect(parseProjectFile(file).ok).toBe(true);
  });
});

describe("parseProjectFile — rejects malformed and foreign files", () => {
  it.each([
    ["not JSON", "{ nope", "invalid-json"],
    ["empty text", "", "invalid-json"],
    ["a JSON array", "[]", "not-a-project"],
    ["JSON null", "null", "not-a-project"],
    [
      "another format",
      JSON.stringify({ format: "figma", formatVersion: 1 }),
      "not-a-project",
    ],
  ] as const)("%s", (_label, text, code) => {
    expectRejected(text, code);
  });

  it.each([
    ["missing", undefined, "not-a-project"],
    ["a string", "1", "not-a-project"],
    ["zero", 0, "not-a-project"],
    ["fractional", 1.5, "not-a-project"],
    ["a future version", 2, "unsupported-version"],
  ] as const)("a format version that is %s", (_label, formatVersion, code) => {
    expectRejected(JSON.stringify({ ...validFile(), formatVersion }), code);
  });

  it("explains that newer files need a newer Layoutry", () => {
    const error = expectRejected(
      JSON.stringify({ ...validFile(), formatVersion: 7 }),
      "unsupported-version",
    );
    expect(error?.message).toMatch(/newer version of Layoutry/);
  });
});

describe("parseProjectFile — validates structure", () => {
  it.each([
    ["an unknown envelope field", { ...validFile(), extra: true }],
    [
      "an unknown metadata field",
      { ...validFile(), project: { ...metadata, owner: "someone" } },
    ],
    [
      "an empty project name",
      { ...validFile(), project: { ...metadata, name: "   " } },
    ],
    [
      "a non-ISO timestamp",
      { ...validFile(), project: { ...metadata, createdAt: "yesterday" } },
    ],
    [
      "an invalid project id",
      { ...validFile(), project: { ...metadata, id: "../../etc" } },
    ],
    ["a missing document", { ...validFile(), document: undefined }],
  ])("%s", (_label, file) => {
    expectRejected(JSON.stringify(file), "invalid-structure");
  });

  it.each([
    ["an unknown element type", { id: "script-1", tag: "script" }],
    [
      "an unknown element field",
      { id: "div-1", tag: "div", onclick: "alert(1)" },
    ],
    ["an invalid element id", { id: "bad id!", tag: "div" }],
    [
      "a javascript: link",
      { id: "a-1", tag: "a", href: "JavaScript:alert(1)" },
    ],
    [
      "a javascript: media source",
      { id: "img-1", tag: "img", src: " javascript:alert(1)" },
    ],
    [
      "a CSS-breaking background URL",
      { id: "div-1", tag: "div", background: { image: 'x") ; color: red' } },
    ],
    [
      "a wrong value type",
      { id: "div-1", tag: "div", transform: { scale: "2" } },
    ],
    [
      "an invalid enum value",
      { id: "div-1", tag: "div", display: { display: "flexbox" } },
    ],
  ])("%s", (_label, node) => {
    const error = expectRejected(
      withDocument(pageWith(node as EditorElementNode)),
      "invalid-structure",
    );
    expect(error?.path).toMatch(/^document\.children\[0\]/);
  });

  it("an infinite number (1e999 parses to Infinity)", () => {
    const text = withDocument(pageWith({ id: "div-1", tag: "div" })).replace(
      '"tag":"div"',
      '"tag":"div","transform":{"scale":1e999}',
    );
    expectRejected(text, "invalid-structure");
  });
});

describe("parseProjectFile — protects document integrity", () => {
  it.each([
    ["a root that is not a page", { id: "div-root", tag: "div" }],
    ["a nested page element", pageWith({ id: "page-2", tag: "page" })],
    [
      "duplicate element ids",
      pageWith({ id: "p-1", tag: "p" }, { id: "p-1", tag: "p" }),
    ],
    [
      "children under a non-container",
      pageWith({ id: "p-1", tag: "p", children: [{ id: "p-2", tag: "p" }] }),
    ],
    [
      "an interaction aimed at a missing element",
      pageWith({
        id: "button-1",
        tag: "button",
        interactions: [
          { id: "i-1", trigger: "click", action: "show", targetId: "ghost" },
        ],
      }),
    ],
    [
      "duplicate ids inside one list",
      pageWith({
        id: "div-1",
        tag: "div",
        boxShadow: [
          { id: "s-1", enabled: true, inset: false },
          { id: "s-1", enabled: true, inset: false },
        ],
      }),
    ],
  ])("%s", (_label, document) => {
    expectRejected(withDocument(document), "integrity");
  });
});

describe("parseProjectFile — survives hostile input", () => {
  it.each(["__proto__", "constructor", "prototype"])(
    'rejects a "%s" key anywhere, without polluting prototypes',
    (key) => {
      const text = withDocument(pageWith({ id: "div-1", tag: "div" })).replace(
        '"tag":"div"',
        `"tag":"div","${key}":{"polluted":true}`,
      );
      const error = expectRejected(text, "forbidden-key");
      expect(error?.path).toBe(`document.children[0].${key}`);
      expect(Reflect.get({}, "polluted")).toBeUndefined();
      expect(Reflect.get(Object.prototype, "polluted")).toBeUndefined();
    },
  );

  it("rejects files over the size limit before parsing", () => {
    const limits = { ...DEFAULT_PROJECT_LIMITS, maxFileCharacters: 1_000 };
    expectRejected(
      JSON.stringify(validFile()).padEnd(1_001, " "),
      "too-large",
      limits,
    );
  });

  it("rejects text over the real 16 Mi-character limit", () => {
    expectRejected(
      " ".repeat(DEFAULT_PROJECT_LIMITS.maxFileCharacters + 1),
      "too-large",
    );
  });

  it("rejects absurdly deep JSON without recursing (100,000 levels)", () => {
    const deep = `${"[".repeat(100_000)}${"]".repeat(100_000)}`;
    expectRejected(deep, "too-complex");
  });

  it("rejects element nesting beyond the depth limit", () => {
    const limits = { ...DEFAULT_PROJECT_LIMITS, maxElementDepth: 10 };
    expect(parseProjectFile(withDocument(nestedDocument(10)), limits).ok).toBe(
      true,
    );
    expectRejected(withDocument(nestedDocument(11)), "too-complex", limits);
  });

  it("rejects documents over the element-count limit", () => {
    const limits = { ...DEFAULT_PROJECT_LIMITS, maxElementNodes: 50 };
    const many = (count: number) =>
      pageWith(
        ...Array.from({ length: count }, (_, index) => ({
          id: `p-${index}`,
          tag: "p",
        })),
      );
    expect(parseProjectFile(withDocument(many(49)), limits).ok).toBe(true);
    expectRejected(withDocument(many(50)), "too-complex", limits);
  });

  it("rejects too many JSON values", () => {
    const limits = { ...DEFAULT_PROJECT_LIMITS, maxJsonValues: 100 };
    expectRejected(
      JSON.stringify({
        ...validFile(),
        padding: Array.from({ length: 200 }, () => 0),
      }),
      "too-complex",
      limits,
    );
  });

  it("loads a large legitimate project (5,000 elements) quickly", () => {
    const large = pageWith(
      ...Array.from({ length: 1_000 }, (_, index) => ({
        id: `section-${index}`,
        tag: "section",
        children: Array.from({ length: 4 }, (__, child) => ({
          id: `p-${index}-${child}`,
          tag: "p",
          text: "Lorem ipsum",
        })),
      })),
    );
    const text = serializeProject({ metadata, document: large });
    const started = performance.now();
    const result = parseProjectFile(text);
    expect(result.ok).toBe(true);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
