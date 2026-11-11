import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createContainerNode, createImageNode, createParagraphNode } from "@/features/editor/factories/elementFactories";
import { registerDocumentSaveLimitGuard } from "@/features/editor/rules/documentSaveLimitGuard";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";
import { DEFAULT_PROJECT_LIMITS } from "@/features/project/rules/projectLimits";
import { documentFitsProjectFile } from "@/features/project/rules/projectSaveLimit";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { prepareRecoverySnapshot } from "@/features/project/utils/prepareRecoverySnapshot";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { COPY_TOO_LARGE_NOTICE, useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const fixture = (...parts: string[]) => readFileSync(path.join(process.cwd(), "test", "fixtures", ...parts));
const PNG_DATA_URL = `data:image/png;base64,${fixture("images", "upload-40x30.png").toString("base64")}`;
const GIF_DATA_URL = `data:image/gif;base64,${fixture("images", "upload-20x10-animated.gif").toString("base64")}`;
/** About 7 Mi characters: two copies fit in a project, three do not. */
const bigDataUrl = (fill: string) => "data:image/png;base64," + fill.repeat(7_000_000);
const node = (id: string) => findNodeById(store().document, id);
const images = () => {
  const found: EditorElementNode[] = [];
  const visit = (current: EditorElementNode) => {
    if (current.tag === "img") found.push(current);
    current.children?.forEach(visit);
  };
  visit(store().document);
  return found;
};

function saveAndReopen(document: EditorElementNode = store().document): EditorElementNode {
  const text = serializeProject({ metadata: createProjectMetadata({ id: "project-1", now: new Date(0) }), document });
  const reopened = parseProjectFile(text);
  if (!reopened.ok) throw new Error(reopened.error.message);
  return reopened.project.document;
}

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("Image alt text (BC-07.2)", () => {
  let imageId: string;
  beforeEach(() => {
    const image = createImageNode();
    store().insertElement("page-root", image);
    imageId = image.id;
  });

  it("is one Undo step per edit; Undo and Redo restore it", () => {
    const history = store().past.length;
    store().setElementAltText(imageId, "A red bicycle");
    expect(node(imageId)?.displayName).toBe("A red bicycle");
    expect(store().past.length).toBe(history + 1);
    store().setElementAltText(imageId, "A blue bicycle");
    store().undo();
    expect(node(imageId)?.displayName).toBe("A red bicycle");
    store().redo();
    expect(node(imageId)?.displayName).toBe("A blue bicycle");
  });

  it("empty clears it (a decorative image), and an unchanged value adds no history", () => {
    store().setElementAltText(imageId, "Logo");
    store().setElementAltText(imageId, "");
    expect(node(imageId)).not.toHaveProperty("displayName");
    const history = store().past.length;
    store().setElementAltText(imageId, undefined);
    expect(store().past.length).toBe(history);
  });

  it("only changes Images", () => {
    const paragraph = createParagraphNode();
    store().insertElement("page-root", paragraph);
    const before = store().document;
    store().setElementAltText(paragraph.id, "nope");
    expect(store().document).toBe(before);
  });

  it("replacing the image keeps the authored alt text", () => {
    store().setElementAltText(imageId, "Team photo");
    store().setElementSrc(imageId, PNG_DATA_URL);
    expect(node(imageId)?.displayName).toBe("Team photo");
  });

  it("survives save and reopen and is exported, escaped, on the same <img> as the embedded source", () => {
    store().setElementSrc(imageId, PNG_DATA_URL);
    store().setElementAltText(imageId, `A "quoted" <b> & 'single'`);
    const reopened = saveAndReopen();
    expect(findNodeById(reopened, imageId)).toMatchObject({ src: PNG_DATA_URL, displayName: `A "quoted" <b> & 'single'` });

    for (const mode of ["standalone", "separate"] as const) {
      const result = exportHtmlCss(reopened, { mode, title: "Alt" });
      expect(result.ok).toBe(true);
      const html = result.files.find((file) => file.path === "index.html")!.content;
      expect(html).toContain(`src="${PNG_DATA_URL}" alt="A &quot;quoted&quot; &lt;b&gt; &amp; &#39;single&#39;"`);
      expect(result.assets).toContainEqual({ nodeId: imageId, property: "src", url: PNG_DATA_URL, kind: "data" });
      expect(result.diagnostics.filter((d) => d.nodeId === imageId)).toEqual([]);
    }
  });
});

describe("embedded images through persistence and export (BC-07.2)", () => {
  it("PNG and animated GIF sources save, reopen, recover and export byte for byte", async () => {
    const png = createImageNode();
    const gif = createImageNode();
    store().insertElement("page-root", png);
    store().insertElement("page-root", gif);
    store().setElementSrc(png.id, PNG_DATA_URL);
    store().setElementSrc(gif.id, GIF_DATA_URL);

    const reopened = saveAndReopen();
    expect(reopened).toEqual(store().document);
    const snapshot = await prepareRecoverySnapshot({ metadata: createProjectMetadata({ id: "p", now: new Date(0) }), document: store().document }, DEFAULT_PROJECT_LIMITS, async () => "hash");
    const recovered = parseProjectFile(snapshot.text);
    expect(recovered.ok && findNodeById(recovered.project.document, gif.id)?.src).toBe(GIF_DATA_URL);

    const html = exportHtmlCss(reopened, { mode: "standalone", title: "x" }).files[0].content;
    const exported = [...html.matchAll(/src="(data:image\/[a-z]+;base64,[^"]+)"/g)].map((match) => match[1]);
    expect(exported).toEqual(expect.arrayContaining([PNG_DATA_URL, GIF_DATA_URL]));
    expect(Buffer.from(GIF_DATA_URL.split(",")[1], "base64").equals(fixture("images", "upload-20x10-animated.gif"))).toBe(true);
  });

  it("a format 1 (PROJECT-1.1) file takes an uploaded image and alt text and saves as format 2", () => {
    const opened = parseProjectFile(fixture("persistence", "project-1.1-every-element.layoutry").toString("utf8"));
    if (!opened.ok) throw new Error(opened.error.message);
    store().replaceDocument(opened.project.document);
    const image = images()[0];
    expect(image).toBeDefined();
    store().setElementSrc(image.id, PNG_DATA_URL);
    store().setElementAltText(image.id, "Legacy image");
    const text = serializeProject({ metadata: opened.project.metadata, document: store().document });
    expect(JSON.parse(text).formatVersion).toBe(2);
    const reopened = parseProjectFile(text);
    expect(reopened.ok && findNodeById(reopened.project.document, image.id)).toMatchObject({ src: PNG_DATA_URL, displayName: "Legacy image" });
  });

  it("existing documents without alt text stay valid and export alt=\"\"", () => {
    const image = createImageNode();
    store().insertElement("page-root", image);
    const reopened = saveAndReopen();
    expect(findNodeById(reopened, image.id)).not.toHaveProperty("displayName");
    expect(exportHtmlCss(reopened, { mode: "standalone" }).files[0].content).toMatch(/<img [^>]*alt=""/);
  });
});

describe("duplicate and paste of embedded images (BC-07.2)", () => {
  let unregister: () => void;
  beforeEach(() => {
    unregister = registerDocumentSaveLimitGuard(documentFitsProjectFile);
  });
  afterEach(() => unregister());

  it("duplicate and copy/paste give new ids, keep the source, and are one Undo step", () => {
    const image = createImageNode();
    store().insertElement("page-root", image);
    store().setElementSrc(image.id, PNG_DATA_URL);
    store().setElementAltText(image.id, "Photo");
    store().selectElement(image.id);
    const history = store().past.length;

    store().duplicateSelection();
    store().copySelection();
    store().pasteClipboard();
    const all = images().filter((candidate) => candidate.src === PNG_DATA_URL);
    expect(all).toHaveLength(3);
    expect(new Set(all.map((candidate) => candidate.id)).size).toBe(3);
    expect(all.every((candidate) => candidate.displayName === "Photo")).toBe(true);
    expect(store().past.length).toBe(history + 2);
    expect(saveAndReopen()).toEqual(store().document);

    store().undo();
    store().undo();
    expect(images().filter((candidate) => candidate.src === PNG_DATA_URL)).toHaveLength(1);
    store().redo();
    expect(images().filter((candidate) => candidate.src === PNG_DATA_URL)).toHaveLength(2);
  });

  it("refuses a duplicate that would make the project unsaveable: no change, no history, a notice", () => {
    const image = createImageNode();
    store().insertElement("page-root", image);
    store().setElementSrc(image.id, bigDataUrl("A"));
    store().selectElement(image.id);
    store().duplicateSelection();
    expect(images().filter((candidate) => candidate.src === bigDataUrl("A"))).toHaveLength(2);
    expect(() => saveAndReopen()).not.toThrow();

    const before = { document: store().document, past: store().past };
    store().duplicateSelection();
    expect(store().document).toBe(before.document);
    expect(store().past).toBe(before.past);
    expect(store().editorNotice?.message).toBe(COPY_TOO_LARGE_NOTICE);
  });

  it("refuses a paste of a container holding a large embedded image the same way", () => {
    const container = createContainerNode();
    const image = createImageNode();
    store().insertElement("page-root", container);
    store().insertElement(container.id, image);
    store().setElementSrc(image.id, bigDataUrl("B"));
    store().selectElement(container.id);
    store().copySelection();
    store().pasteClipboard();
    expect(images().filter((candidate) => candidate.src === bigDataUrl("B"))).toHaveLength(2);
    const before = store().document;
    store().pasteClipboard();
    expect(store().document).toBe(before);
    expect(store().editorNotice?.message).toBe(COPY_TOO_LARGE_NOTICE);
  });

  it("cut then paste of a large image is allowed (the project size doesn't grow)", () => {
    const filler = createImageNode();
    const image = createImageNode();
    store().insertElement("page-root", filler);
    store().insertElement("page-root", image);
    store().setElementSrc(filler.id, bigDataUrl("C"));
    store().setElementSrc(image.id, bigDataUrl("D"));
    store().selectElement(image.id);
    store().cutSelection();
    store().pasteClipboard();
    expect(images().filter((candidate) => candidate.src === bigDataUrl("D"))).toHaveLength(1);
  });

  it("ordinary copies are never measured or refused, and without a registered guard nothing is refused", () => {
    unregister();
    const image = createImageNode();
    store().insertElement("page-root", image);
    store().setElementSrc(image.id, bigDataUrl("E"));
    store().selectElement(image.id);
    store().duplicateSelection();
    store().duplicateSelection();
    expect(images().filter((candidate) => candidate.src === bigDataUrl("E"))).toHaveLength(3);
  });
});
