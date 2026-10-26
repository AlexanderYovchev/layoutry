// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import {
  CURRENT_PROJECT_FORMAT_VERSION,
  DEFAULT_PROJECT_NAME,
  PROJECT_FILE_FORMAT,
} from "@/features/project/types/projectFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import {
  fixtureDocument,
  kitchenSinkNode,
  pageWith,
} from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  generateProjectId,
  ProjectSerializationError,
  serializeProject,
  touchProjectMetadata,
} from "@/features/project/utils/serializeProject";

const NOW = new Date("2026-10-26T09:30:00.000Z");
const metadata = createProjectMetadata({ id: "project-1", now: NOW });

describe("createProjectMetadata", () => {
  it("creates an untitled project with a stable id and equal ISO timestamps", () => {
    expect(metadata).toEqual({
      id: "project-1",
      name: DEFAULT_PROJECT_NAME,
      createdAt: "2026-10-26T09:30:00.000Z",
      updatedAt: "2026-10-26T09:30:00.000Z",
    });
  });

  it("generates RFC 4122 v4 ids by default", () => {
    const id = createProjectMetadata().id;
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(generateProjectId()).not.toBe(id);
  });

  it("only changes updatedAt when explicitly touched", () => {
    const later = new Date("2026-10-27T00:00:00.000Z");
    expect(touchProjectMetadata(metadata, later)).toEqual({
      ...metadata,
      updatedAt: "2026-10-27T00:00:00.000Z",
    });
    expect(metadata.updatedAt).toBe("2026-10-26T09:30:00.000Z");
  });
});

describe("serializeProject", () => {
  it("writes the versioned envelope with metadata and the document root", () => {
    const parsed: unknown = JSON.parse(
      serializeProject({ metadata, document: fixtureDocument }),
    );
    expect(parsed).toMatchObject({
      format: PROJECT_FILE_FORMAT,
      formatVersion: CURRENT_PROJECT_FORMAT_VERSION,
      project: metadata,
      document: { id: "page-root", tag: "page" },
    });
    expect(Object.keys(parsed as object)).toEqual([
      "format",
      "formatVersion",
      "project",
      "document",
    ]);
  });

  it("is deterministic regardless of property insertion order", () => {
    const a: EditorElementNode = {
      id: "p-1",
      tag: "p",
      text: "Hi",
      typography: { color: "#000000", fontWeight: 700 },
    };
    const b: EditorElementNode = {
      typography: { fontWeight: 700, color: "#000000" },
      text: "Hi",
      tag: "p",
      id: "p-1",
    };
    expect(serializeProject({ metadata, document: pageWith(a) })).toBe(
      serializeProject({ metadata, document: pageWith(b) }),
    );
  });

  it("is pure: the input is not mutated and ids, order and timestamps are preserved", () => {
    const document = pageWith(kitchenSinkNode());
    const before = structuredClone(document);
    const text = serializeProject({ metadata, document });
    expect(document).toEqual(before);
    const parsed = JSON.parse(text);
    expect(parsed.project.updatedAt).toBe(metadata.updatedAt);
    expect(
      parsed.document.children[0].children.map(
        (child: EditorElementNode) => child.id,
      ),
    ).toEqual(kitchenSinkNode().children?.map((child) => child.id));
  });

  it("omits undefined properties instead of writing them", () => {
    const text = serializeProject({
      metadata,
      document: pageWith({ id: "p-1", tag: "p", text: undefined }),
    });
    expect(text).not.toContain("undefined");
    expect(JSON.parse(text).document.children[0]).toEqual({
      id: "p-1",
      tag: "p",
    });
  });

  it("refuses cyclic or shared in-memory documents instead of overflowing", () => {
    const child: EditorElementNode = { id: "div-1", tag: "div" };
    child.children = [child];
    expect(() =>
      serializeProject({ metadata, document: pageWith(child) }),
    ).toThrow(ProjectSerializationError);
  });

  it("refuses values a project file cannot represent", () => {
    const nan: EditorElementNode = {
      id: "div-1",
      tag: "div",
      transform: { scale: Number.NaN },
    };
    expect(() =>
      serializeProject({ metadata, document: pageWith(nan) }),
    ).toThrow(/not a finite number/);
  });

  it("never writes a file it could not load back", () => {
    const invalid: EditorElementNode = {
      id: "a-1",
      tag: "a",
      href: "javascript:alert(1)",
    };
    expect(() =>
      serializeProject({ metadata, document: pageWith(invalid) }),
    ).toThrow(ProjectSerializationError);
    const text = serializeProject({ metadata, document: fixtureDocument });
    expect(parseProjectFile(text).ok).toBe(true);
  });
});
