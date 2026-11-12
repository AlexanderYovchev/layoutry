import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIframeNode, createVideoEmbedNode, getDefaultFreeElementSizeForNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isVideoEmbedNode } from "@/features/editor/types/videoEmbed";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { CURRENT_PROJECT_FORMAT_VERSION } from "@/features/project/types/projectFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id);
const YOUTUBE_SRC = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";

function iframes(document: EditorElementNode = store().document): EditorElementNode[] {
  const found: EditorElementNode[] = [];
  const visit = (current: EditorElementNode) => {
    if (current.tag === "iframe") found.push(current);
    current.children?.forEach(visit);
  };
  visit(document);
  return found;
}

function saveAndReopen(document: EditorElementNode = store().document): { document: EditorElementNode; text: string } {
  const text = serializeProject({ metadata: createProjectMetadata({ id: "project-1", now: new Date(0) }), document });
  const reopened = parseProjectFile(text);
  if (!reopened.ok) throw new Error(reopened.error.message);
  return { document: reopened.project.document, text };
}

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("Video Embed identity (BC-08.2)", () => {
  it("is the existing Embed element, marked by its controls field, with a responsive 16:9 box", () => {
    const embed = createVideoEmbedNode();
    expect(embed).toEqual({ id: embed.id, tag: "iframe", title: "Embedded video", controls: true, aspectRatio: { mode: "ratio", width: 16, height: 9 } });
    expect(isVideoEmbedNode(embed)).toBe(true);
    expect(isVideoEmbedNode({ ...embed, controls: false })).toBe(true);
    expect(getElementDisplayName(embed)).toBe("Video Embed");
  });

  it("a generic Embed is never a Video Embed, whatever its URL", () => {
    const generic = createIframeNode();
    expect(isVideoEmbedNode(generic)).toBe(false);
    const withYouTube: EditorElementNode = { ...generic, src: YOUTUBE_SRC };
    const withVimeo: EditorElementNode = { ...generic, src: "https://vimeo.com/76979871" };
    const video: EditorElementNode = { id: "v", tag: "video", controls: true };
    expect(isVideoEmbedNode(withYouTube)).toBe(false);
    expect(isVideoEmbedNode(withVimeo)).toBe(false);
    expect(getElementDisplayName(withYouTube)).toBe("Embed");
    // Only an iframe can be one.
    expect(isVideoEmbedNode(video)).toBe(false);
  });

  it("a user-renamed Video Embed keeps its name", () => {
    expect(getElementDisplayName({ ...createVideoEmbedNode(), displayName: "Intro video" })).toBe("Intro video");
  });
});

describe("Video Embed in the document", () => {
  let embedId: string;
  beforeEach(() => {
    const embed = createVideoEmbedNode();
    const history = store().past.length;
    store().insertElement("page-root", embed);
    embedId = embed.id;
    // Insertion is one Undo step.
    expect(store().past.length).toBe(history + 1);
  });

  it("an empty Video Embed keeps its identity through save and reopen, in project format 2", () => {
    const { document, text } = saveAndReopen();
    expect(JSON.parse(text).formatVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION);
    expect(CURRENT_PROJECT_FORMAT_VERSION).toBe(2);
    const reopened = findNodeById(document, embedId);
    expect(reopened).toEqual(node(embedId));
    expect(reopened && isVideoEmbedNode(reopened)).toBe(true);
  });

  it("settings survive save and reopen exactly", () => {
    store().setElementSrc(embedId, YOUTUBE_SRC);
    store().setElementMuted(embedId, true);
    store().setElementAutoplay(embedId, true);
    store().setElementLoop(embedId, true);
    store().setElementControls(embedId, false);
    store().setElementTitle(embedId, "Product demo");
    expect(findNodeById(saveAndReopen().document, embedId)).toEqual(node(embedId));
  });

  it("each playback setting is one Undo step; Undo and Redo restore it", () => {
    const history = store().past.length;
    store().setElementMuted(embedId, true);
    store().setElementAutoplay(embedId, true);
    expect(store().past.length).toBe(history + 2);
    store().undo();
    expect(node(embedId)?.autoplay).toBeUndefined();
    expect(node(embedId)?.muted).toBe(true);
    store().redo();
    expect(node(embedId)?.autoplay).toBe(true);
  });

  it("Duplicate is one Undo step and gives an independent Video Embed", () => {
    store().setElementSrc(embedId, YOUTUBE_SRC);
    store().selectElement(embedId);
    const history = store().past.length;
    store().duplicateSelection();
    expect(store().past.length).toBe(history + 1);
    const [original, copy] = iframes();
    expect(copy.id).not.toBe(original.id);
    expect(isVideoEmbedNode(copy)).toBe(true);
    expect({ ...copy, id: original.id }).toEqual(original);
    store().setElementMuted(copy.id, true);
    expect(node(embedId)?.muted).toBeUndefined();
  });

  it("Copy and Paste is one Undo step and keeps the identity, even while empty", () => {
    store().selectElement(embedId);
    store().copySelection();
    const history = store().past.length;
    store().pasteClipboard();
    expect(store().past.length).toBe(history + 1);
    expect(iframes()).toHaveLength(2);
    expect(iframes().every((iframe) => isVideoEmbedNode(iframe))).toBe(true);
  });

  it("a generic Embed next to it is untouched by save, reopen and duplicate", () => {
    const generic = createIframeNode();
    store().insertElement("page-root", { ...generic, src: YOUTUBE_SRC });
    store().selectElement(generic.id);
    store().duplicateSelection();
    const reopened = iframes(saveAndReopen().document);
    expect(reopened.filter((iframe) => isVideoEmbedNode(iframe))).toHaveLength(1);
    expect(reopened.filter((iframe) => !isVideoEmbedNode(iframe)).map((iframe) => iframe.controls)).toEqual([undefined, undefined]);
  });
});

describe("Video Embed default size", () => {
  it("its Free-layout default size is 16:9 (480x270); a generic Embed keeps 400x300", () => {
    expect(getDefaultFreeElementSizeForNode(createVideoEmbedNode())).toEqual({ width: 480, height: 270 });
    expect(getDefaultFreeElementSizeForNode(createIframeNode())).toEqual({ width: 400, height: 300 });
  });
});
