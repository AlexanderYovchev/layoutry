import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createButtonNode, createContainerNode, createImageNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { exportHtmlCss } from "./exportHtmlCss";
import { zipExportPackage } from "./zipExportPackage";

const initial = useEditorStore.getState();
const store = () => useEditorStore.getState();
const fixture = (name: string) => readFileSync(path.join(process.cwd(), "test", "fixtures", "images", name));
const PNG = `data:image/png;base64,${fixture("upload-40x30.png").toString("base64")}`;
const JPEG = `data:image/jpeg;base64,${fixture("upload-32x24.jpg").toString("base64")}`;

/** Everything authored or historical: the serialized project, both history stacks, selection and the saved baseline. */
function snapshot() {
  const state = store();
  return {
    project: serializeProject({ metadata: createProjectMetadata({ id: "p", now: new Date(0) }), document: state.document }),
    document: state.document,
    past: state.past,
    future: state.future,
    selection: state.selection,
    persisted: state.persistedDocument,
    pastJson: JSON.stringify(state.past),
    futureJson: JSON.stringify(state.future),
  };
}

function exportEverything() {
  const document = store().document;
  const results = [exportHtmlCss(document, { mode: "standalone", title: "T" }), exportHtmlCss(document, { mode: "separate", title: "T" })];
  zipExportPackage(results[1].files, results[1].assetFiles);
  return results;
}

afterEach(() => useEditorStore.setState(initial, true));

describe("export leaves the authored document and its history untouched (BC-07.4)", () => {
  it("zero differences after repeated exports, including after Undo and Redo", () => {
    const container = createContainerNode();
    const image = createImageNode();
    const copy = createImageNode();
    const trigger = createButtonNode();
    store().insertElement("page-root", container);
    store().insertElement(container.id, image);
    store().insertElement("page-root", copy);
    store().insertElement("page-root", trigger);
    store().setElementSrc(image.id, PNG);
    store().setElementAltText(image.id, `Café "quote" & <tag>`);
    store().setElementSrc(copy.id, JPEG);
    store().setElementFilters(image.id, { opacity: 50 });
    store().addInteraction(trigger.id, { trigger: "click", action: "toggle", targetId: image.id });
    store().selectElement(image.id);
    store().markDocumentPersisted(store().document);

    const check = () => {
      const before = snapshot();
      const first = exportEverything();
      const second = exportEverything();
      const after = snapshot();
      expect(after.document).toBe(before.document);
      expect(after.past).toBe(before.past);
      expect(after.future).toBe(before.future);
      expect(after.selection).toBe(before.selection);
      expect(after.persisted).toBe(before.persisted);
      expect(after.project).toBe(before.project);
      expect(after.pastJson).toBe(before.pastJson);
      expect(after.futureJson).toBe(before.futureJson);
      // Repeated exports are identical.
      expect(second[0].files).toEqual(first[0].files);
      expect(second[1].files).toEqual(first[1].files);
      expect(second[1].assetFiles).toEqual(first[1].assetFiles);
      return first;
    };

    const now = check();
    expect(now[1].assetFiles.map((file) => file.path)).toEqual(["assets/image-001.png", "assets/image-002.jpg"]);
    expect(now[1].files[0].content).toContain(`alt="Café &quot;quote&quot; &amp; &lt;tag&gt;"`);

    store().undo(); // the interaction
    store().undo(); // the opacity
    check();
    store().redo();
    check();
    expect(store().document.children!.some((child) => child.id === trigger.id)).toBe(true);
  });
});
