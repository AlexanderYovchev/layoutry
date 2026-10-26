// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { LayoutryProject } from "@/features/project/types/projectFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import {
  everyFactoryDocument,
  fixtureDocument,
  kitchenSinkNode,
  nestedDocument,
  pageWith,
} from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";

const metadata = createProjectMetadata({
  id: "project-1",
  name: "Round Trip",
  now: new Date("2026-10-26T00:00:00.000Z"),
});

function roundTrip(document: EditorElementNode): LayoutryProject {
  const result = parseProjectFile(serializeProject({ metadata, document }));
  if (!result.ok)
    throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.project;
}

describe("project round trip (editor document → JSON → editor document)", () => {
  it.each([
    ["an empty page", pageWith()],
    ["the starter document", fixtureDocument],
    [
      "every element and component the editor can create",
      everyFactoryDocument(),
    ],
    [
      "every authored field family (layout, styles, media, forms, SVG, interactions, transitions, transforms)",
      pageWith(kitchenSinkNode()),
    ],
    ["a 60-level deep layout", nestedDocument(60)],
  ])("preserves %s exactly", (_label, document) => {
    const restored = roundTrip(document);
    expect(restored.document).toEqual(document);
    expect(restored.metadata).toEqual(metadata);
  });

  it("keeps ids and child order for complex components", () => {
    const document = pageWith(
      createElementNode("pricingCard"),
      createElementNode("contactForm"),
      createElementNode("table"),
    );
    const ids = (node: EditorElementNode): string[] => [
      node.id,
      ...(node.children ?? []).flatMap(ids),
    ];
    expect(ids(roundTrip(document).document)).toEqual(ids(document));
  });

  it("is stable: a second round trip produces the identical file", () => {
    // Built once: factories generate fresh random ids on every call.
    const document = everyFactoryDocument();
    const first = serializeProject({ metadata, document });
    expect(serializeProject(roundTrip(document))).toBe(first);
    const restoredOnce = parseProjectFile(first);
    if (!restoredOnce.ok) throw new Error(restoredOnce.error.message);
    expect(serializeProject(restoredOnce.project)).toBe(first);
  });

  it("returns fresh objects that do not alias the parsed input", () => {
    const text = serializeProject({ metadata, document: fixtureDocument });
    const a = parseProjectFile(text);
    const b = parseProjectFile(text);
    if (!a.ok || !b.ok) throw new Error("load failed");
    expect(a.project.document).not.toBe(b.project.document);
    expect(a.project.document).toEqual(b.project.document);
  });
});
