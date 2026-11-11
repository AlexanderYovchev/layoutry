import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { DEFAULT_PROJECT_LIMITS } from "@/features/project/rules/projectLimits";
import { MAX_PROJECT_NAME_LENGTH } from "@/features/project/rules/projectName";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { documentFitsProjectFile } from "./projectSaveLimit";

const PREFIX = "data:image/png;base64,";
const limit = DEFAULT_PROJECT_LIMITS.maxFileCharacters;

function pageWithImage(base64Length: number): EditorElementNode {
  return { id: "page-root", tag: "page", children: [{ id: "img-1", tag: "img", src: PREFIX + "A".repeat(base64Length) }] };
}

/** The largest base64 payload documentFitsProjectFile still accepts, found by bisection. */
function largestFittingPayload(): number {
  let low = 0;
  let high = limit;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (documentFitsProjectFile(pageWithImage(middle))) low = middle;
    else high = middle - 1;
  }
  return low;
}

describe("documentFitsProjectFile (BC-07.2): the upload/paste preflight uses Save's own size rule", () => {
  const fitting = largestFittingPayload();

  it("has an exact boundary: one more character no longer fits", () => {
    expect(documentFitsProjectFile(pageWithImage(fitting))).toBe(true);
    expect(documentFitsProjectFile(pageWithImage(fitting + 1))).toBe(false);
  });

  it("whatever fits really saves and reopens, even with the longest, most escaped project name", () => {
    const document = pageWithImage(fitting);
    for (const name of ["Untitled project", '"'.repeat(MAX_PROJECT_NAME_LENGTH), "\\".repeat(MAX_PROJECT_NAME_LENGTH)]) {
      const text = serializeProject({ metadata: createProjectMetadata({ name, now: new Date(0) }), document });
      expect(text.length).toBeLessThanOrEqual(limit);
    }
  });

  it("is conservative by no more than the worst-case metadata (about 1.6 KB of a 16 Mi limit)", () => {
    // The same document with real, short metadata would still save with this much more payload.
    const document = pageWithImage(fitting + 1);
    expect(() => serializeProject({ metadata: createProjectMetadata({ now: new Date(0) }), document })).not.toThrow();
    const realSlack = limit - serializeProject({ metadata: createProjectMetadata({ now: new Date(0) }), document: pageWithImage(fitting) }).length;
    expect(realSlack).toBeLessThan(2048);
  });

  it("a document Save would refuse to write never fits", () => {
    const broken: EditorElementNode = { id: "page-root", tag: "page", children: [{ id: "x", tag: "div", filters: { opacity: Number.NaN } }] };
    expect(documentFitsProjectFile(broken)).toBe(false);
  });

  it("an ordinary page fits", () => {
    expect(documentFitsProjectFile(pageWithImage(100))).toBe(true);
  });
});
