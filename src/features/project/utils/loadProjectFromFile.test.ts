import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_LIMITS } from "@/features/project/rules/projectLimits";
import { loadProjectFromFile } from "@/features/project/utils/loadProjectFromFile";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";

const project = {
  metadata: createProjectMetadata({ id: "project-1", name: "Imported" }),
  document: pageWith({ id: "heading-1", tag: "h1", text: "Hello" }),
};

describe("loadProjectFromFile", () => {
  it("reads and validates a .layoutry file", async () => {
    const file = new File([serializeProject(project)], "Imported.layoutry");
    const result = await loadProjectFromFile(file);
    expect(result).toEqual({ ok: true, project });
  });

  it("refuses an oversized file before reading it", async () => {
    let read = false;
    const huge = new Blob(["x".repeat(400)]);
    Object.defineProperty(huge, "text", {
      value: () => {
        read = true;
        return Promise.resolve("");
      },
    });
    const result = await loadProjectFromFile(huge, {
      ...DEFAULT_PROJECT_LIMITS,
      maxFileCharacters: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("too-large");
    expect(read).toBe(false);
  });

  it("still applies the character limit to files under the byte bound", async () => {
    const text = serializeProject(project);
    const result = await loadProjectFromFile(new Blob([text]), {
      ...DEFAULT_PROJECT_LIMITS,
      maxFileCharacters: text.length - 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("too-large");
  });

  it("reports a file that can't be read", async () => {
    const broken = new Blob(["{}"]);
    Object.defineProperty(broken, "text", {
      value: () => Promise.reject(new DOMException("gone", "NotReadableError")),
    });
    const result = await loadProjectFromFile(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unreadable");
  });

  it.each([
    ["not JSON", "<html>", "invalid-json"],
    ["another JSON file", '{"name":"package"}', "not-a-project"],
    [
      "a newer format version",
      JSON.stringify({
        format: "layoutry-project",
        formatVersion: 99,
        project: {},
        document: {},
      }),
      "unsupported-version",
    ],
  ])("rejects %s", async (_label, text, code) => {
    const result = await loadProjectFromFile(new Blob([text]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });
});
