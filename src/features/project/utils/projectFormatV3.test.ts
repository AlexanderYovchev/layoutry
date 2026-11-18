// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { MAX_ARIA_LABEL_LENGTH } from "@/features/editor/types/accessibility";
import type { ProjectLoadErrorCode } from "@/features/project/types/projectFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { FORMAT_3_ELEMENT_FIELDS, migrateProjectFile } from "@/features/project/utils/projectFormatMigrations";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";

/**
 * BC-09.2 — project format 3: generic accessibility fields and the
 * Pagination marker. Loading, validation, the 2 → 3 migration and the
 * refusal of files that misuse the new fields.
 */

const metadata = createProjectMetadata({ id: "project-1", now: new Date("2026-11-17T00:00:00.000Z") });

const link = (extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ id: "a-1", tag: "a", text: "1", href: "#", ...extra });

/** A file object written by this build, then given `formatVersion` and `document` as a test needs. */
function file(document: unknown, formatVersion = 3): string {
  const base: Record<string, unknown> = JSON.parse(serializeProject({ metadata, document: pageWith() }));
  return JSON.stringify({ ...base, formatVersion, document });
}

function rejected(text: string, code: ProjectLoadErrorCode) {
  const result = parseProjectFile(text);
  expect(result.ok, "should be rejected").toBe(false);
  if (result.ok) throw new Error("accepted");
  expect(result.error.code).toBe(code);
  return result.error;
}

function accepted(text: string): EditorElementNode {
  const result = parseProjectFile(text);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.project.document;
}

describe("format 3 files", () => {
  it("are what this build writes", () => {
    const text = serializeProject({ metadata, document: pageWith(createPaginationNode()) });
    expect(JSON.parse(text).formatVersion).toBe(3);
  });

  it("round-trip every accessibility field and the marker exactly", () => {
    const document = pageWith(
      {
        id: "nav-1",
        tag: "nav",
        component: "pagination",
        ariaLabel: `Results "pages" <1–3> & more`,
        children: [link({ ariaCurrent: "page" }), link({ id: "a-2", disabled: true }), { id: "b-1", tag: "button", text: "Go", disabled: true, ariaLabel: "Go now" }],
      },
      { id: "header-1", tag: "header", ariaLabel: "Site" },
      link({ id: "a-step", ariaCurrent: "step" }),
    );
    const text = serializeProject({ metadata, document });
    expect(accepted(text)).toEqual(document);
    // Re-saving gives the very same bytes.
    expect(serializeProject({ metadata, document: accepted(text) })).toBe(text);
  });

  it.each(["page", "step", "location", "date", "time", "true"])("accept aria-current %s on a link", (value) => {
    expect(accepted(file(pageWith(link({ ariaCurrent: value as EditorElementNode["ariaCurrent"] }))))).toBeDefined();
  });

  it.each([
    ["aria-current false (absence means false)", link({ ariaCurrent: "false" as never })],
    ["an unknown aria-current token", link({ ariaCurrent: "yes" as never })],
    ["aria-current as a boolean", link({ ariaCurrent: true as never })],
    ["disabled: false (enabled is the field's absence)", link({ disabled: false as never })],
    ["disabled as a string", link({ disabled: "true" as never })],
    ["an empty label", { id: "nav-1", tag: "nav", ariaLabel: "" }],
    ["a blank label", { id: "nav-1", tag: "nav", ariaLabel: "   " }],
    ["a label with a newline", { id: "nav-1", tag: "nav", ariaLabel: "Pagi\nnation" }],
    ["a label with a NUL", { id: "nav-1", tag: "nav", ariaLabel: "Pagi\u0000nation" }],
    ["an overlong label", { id: "nav-1", tag: "nav", ariaLabel: "x".repeat(MAX_ARIA_LABEL_LENGTH + 1) }],
    ["a label as a number", { id: "nav-1", tag: "nav", ariaLabel: 7 }],
    ["an unknown component marker", { id: "nav-1", tag: "nav", component: "carousel" }],
    ["a marker as an object", { id: "nav-1", tag: "nav", component: { kind: "pagination" } }],
    ["a free attribute bag", link({ attributes: { onclick: "alert(1)" } } as never)],
    ["an event-handler field", link({ onclick: "alert(1)" } as never)],
    ["an aria-disabled field (disabled is the one field)", link({ ariaDisabled: true } as never)],
  ])("reject %s", (_label, node) => {
    const error = rejected(file(pageWith(node as EditorElementNode)), "invalid-structure");
    expect(error.path).toMatch(/^document\.children\[0\]/);
  });

  it("accept a label at the maximum length", () => {
    expect(accepted(file(pageWith({ id: "nav-1", tag: "nav", ariaLabel: "x".repeat(MAX_ARIA_LABEL_LENGTH) })))).toBeDefined();
  });

  it.each([
    ["a Pagination marker on a div", { id: "div-1", tag: "div", component: "pagination" }, "component"],
    ["a Pagination marker on a link", link({ component: "pagination" } as never), "component"],
    ["aria-current on a paragraph", { id: "p-1", tag: "p", text: "1", ariaCurrent: "page" }, "ariaCurrent"],
    ["aria-current on a button", { id: "b-1", tag: "button", ariaCurrent: "page" }, "ariaCurrent"],
    ["disabled on a paragraph", { id: "p-1", tag: "p", disabled: true }, "disabled"],
    ["disabled on an input", { id: "i-1", tag: "input", disabled: true }, "disabled"],
    ["a label on a paragraph", { id: "p-1", tag: "p", ariaLabel: "Text" }, "ariaLabel"],
    ["a label on a dialog (its name is derived from its heading)", { id: "d-1", tag: "dialog", ariaLabel: "Dialog" }, "ariaLabel"],
  ] as const)("refuse %s as an integrity error", (_label, node, field) => {
    const error = rejected(file(pageWith(node as EditorElementNode)), "integrity");
    expect(error.path).toBe(`document.children[0].${field}`);
  });

  it("still refuse duplicate ids and dangling interactions in a Pagination", () => {
    const pagination = createPaginationNode();
    const [first, second] = pagination.children!;
    second.id = first.id;
    expect(rejected(file(pageWith(pagination)), "integrity").message).toMatch(/used more than once/);

    const dangling = createPaginationNode();
    dangling.children![4].interactions = [{ id: "i-1", trigger: "click", action: "toggle", targetId: "missing-node" }];
    expect(rejected(file(pageWith(dangling)), "integrity").message).toMatch(/does not exist/);
  });

  it("refuse an unknown future field rather than drop it", () => {
    rejected(file(pageWith(link({ ariaDescription: "later" } as never))), "invalid-structure");
  });

  it("refuse a missing required field", () => {
    rejected(file(pageWith({ tag: "nav" } as never)), "invalid-structure");
    const base: Record<string, unknown> = JSON.parse(file(pageWith()));
    delete base.project;
    rejected(JSON.stringify(base), "invalid-structure");
  });

  it("refuse a newer format", () => {
    expect(rejected(file(pageWith(), 4), "unsupported-version").message).toMatch(/newer version of Layoutry \(format 4\)/);
  });
});

describe("format 2 → 3 migration", () => {
  it("leaves a format 2 document untouched: same nodes, ids and values, only the version changes", () => {
    const document = pageWith({ id: "nav-1", tag: "nav", children: [{ id: "b-1", tag: "button", text: "Previous" }, link()] });
    const raw = JSON.parse(file(document, 2));
    const result = migrateProjectFile(raw);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toEqual({ ...raw, formatVersion: 3 });
    // The input object is never modified, and the result is deterministic.
    expect(raw.formatVersion).toBe(2);
    expect(migrateProjectFile(raw)).toEqual(result);
  });

  it("chains format 1 → 2 → 3", () => {
    const result = parseProjectFile(file(pageWith({ id: "b-1", tag: "button", spacing: { padding: { top: 0, right: 8, bottom: 0, left: 8 } } } as never), 1));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.project.document.children?.[0].spacing).toEqual({ padding: { right: 8, left: 8 } });
    expect(JSON.parse(serializeProject(result.project)).formatVersion).toBe(3);
  });

  it.each([1, 2])("refuses a format %i file that already contains a format 3 field (no version bypass)", (version) => {
    for (const field of FORMAT_3_ELEMENT_FIELDS) {
      const values: Record<string, unknown> = { ariaLabel: "Pagination", ariaCurrent: "page", disabled: true, component: "pagination" };
      const smuggled = { id: "nav-1", tag: "nav", children: [{ id: "a-1", tag: "a", text: "1", href: "#", [field]: values[field] }] };
      const error = rejected(file(pageWith(smuggled), version), "migration-failed");
      expect(error.message).toContain(`"${field}"`);
      expect(error.message).toMatch(/The file itself was not changed/);
    }
  });

  it("refuses a smuggled field even on the root or deep in the tree", () => {
    rejected(file({ id: "page-root", tag: "page", ariaLabel: "x", children: [] }, 2), "migration-failed");
    const deep = pageWith({ id: "d1", tag: "div", children: [{ id: "d2", tag: "div", children: [link({ disabled: true })] }] });
    rejected(file(deep, 2), "migration-failed");
  });

  it("does not convert an old Pagination-looking nav into the new component", () => {
    const old = pageWith({
      id: "nav-1",
      tag: "nav",
      children: [{ id: "b-1", tag: "button", text: "Previous" }, link(), link({ id: "a-2", text: "2" }), { id: "b-2", tag: "button", text: "Next" }],
    });
    const opened = accepted(file(old, 2));
    expect(opened).toEqual(old);
  });
});
