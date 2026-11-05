import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { CanvasInteractionBoundary } from "@/features/canvas/components/CanvasInteractionBoundary";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { selectionFromSingle } from "@/features/editor/types/selection";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

const tree: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "video-auto", tag: "video", src: "/clip.webm", autoplay: true, muted: true, loop: true },
    { id: "video-plain", tag: "video", src: "/clip.webm" },
    { id: "audio-auto", tag: "audio", src: "/tone.ogg", autoplay: true, muted: true },
    { id: "audio-plain", tag: "audio", src: "/tone.ogg" },
    { id: "box", tag: "div", children: [{ id: "video-nested", tag: "video", src: "/clip.webm", autoplay: true, muted: true }] },
  ],
};

function Workspace() {
  const document = useEditorStore((state) => state.document);
  return <CanvasInteractionBoundary document={document} />;
}

function media(nodeId: string) {
  const element = document.querySelector<HTMLMediaElement>(`[data-node-id="${nodeId}"] video, [data-node-id="${nodeId}"] audio`);
  if (!element) throw new Error(`no media for ${nodeId}`);
  return element;
}

function callsOn(spy: MockInstance, nodeId: string) {
  const element = media(nodeId);
  return spy.mock.contexts.filter((context) => context === element).length;
}

let play: MockInstance<HTMLMediaElement["play"]>;
let pause: MockInstance<HTMLMediaElement["pause"]>;

describe("usePreviewMediaPlayback (BC-02.2)", () => {
  beforeEach(() => {
    useEditorStore.getState().replaceDocument(tree);
    play = vi.spyOn(HTMLMediaElement.prototype, "play");
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("never plays or pauses anything while designing", () => {
    render(<Workspace />);
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
  });

  it("B2: entering Preview starts autoplay-enabled media exactly once, video and audio, nested too", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    expect(callsOn(play, "video-auto")).toBe(1);
    expect(callsOn(play, "audio-auto")).toBe(1);
    expect(callsOn(play, "video-nested")).toBe(1);
    expect(play).toHaveBeenCalledTimes(3);
  });

  it("B2: leaves media without autoplay paused", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    expect(callsOn(play, "video-plain")).toBe(0);
    expect(callsOn(play, "audio-plain")).toBe(0);
  });

  it("B2: a muted video is already muted when play() is attempted", () => {
    const mutedAtPlay: boolean[] = [];
    play.mockImplementation(function (this: HTMLMediaElement) {
      mutedAtPlay.push(this.muted);
      return Promise.resolve();
    });
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    expect(mutedAtPlay).toEqual([true, true, true]);
  });

  it("B2: a play() rejected by browser autoplay policy is handled, and nothing is unmuted", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    play.mockImplementation(() => Promise.reject(new DOMException("blocked", "NotAllowedError")));
    try {
      render(<Workspace />);
      act(() => useEditorStore.getState().enterPreview());
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
      expect(media("video-auto").muted).toBe(true);
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("unmuted autoplay is attempted too, left to the browser's policy, and stays unmuted", () => {
    useEditorStore.getState().replaceDocument({ id: "page-root", tag: "page", children: [{ id: "video-sound", tag: "video", src: "/clip.webm", autoplay: true }] });
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    expect(callsOn(play, "video-sound")).toBe(1);
    expect(media("video-sound").muted).toBe(false);
  });

  it("B3: exiting Preview pauses every video and audio, autoplay or not", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    act(() => useEditorStore.getState().exitPreview());
    for (const id of ["video-auto", "video-plain", "audio-auto", "audio-plain", "video-nested"]) {
      expect(callsOn(pause, id)).toBe(1);
    }
  });

  it("repeated Preview sessions play once per entry and pause once per exit", () => {
    render(<Workspace />);
    for (let session = 0; session < 3; session++) {
      act(() => useEditorStore.getState().enterPreview());
      act(() => useEditorStore.getState().exitPreview());
    }
    expect(callsOn(play, "video-auto")).toBe(3);
    expect(callsOn(pause, "video-auto")).toBe(3);
    expect(callsOn(play, "video-plain")).toBe(0);
  });

  it("unrelated store updates during Preview do not call play() again", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    act(() => useEditorStore.getState().selectElement("box"));
    act(() => useEditorStore.getState().setSnapEnabled(false));
    expect(play).toHaveBeenCalledTimes(3);
    expect(pause).not.toHaveBeenCalled();
  });

  it("deleting a media node pauses it; deleting a parent pauses its nested media", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    const direct = media("video-auto");
    const nested = media("video-nested");
    act(() => {
      useEditorStore.setState({ selection: selectionFromSingle("video-auto") });
      useEditorStore.getState().deleteSelection();
    });
    act(() => {
      useEditorStore.setState({ selection: selectionFromSingle("box") });
      useEditorStore.getState().deleteSelection();
    });
    expect(pause.mock.contexts).toContain(direct);
    expect(pause.mock.contexts).toContain(nested);
  });

  it("opening or creating another project ends Preview and pauses the old project's media", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    const old = media("audio-plain");
    act(() => useEditorStore.getState().replaceDocument({ id: "page-2", tag: "page", children: [] }));
    expect(useEditorStore.getState().editorMode).toBe("design");
    expect(pause.mock.contexts).toContain(old);
  });

  it("replacing a media source in Preview keeps the element and does not re-trigger play()", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    const before = media("video-auto");
    act(() => useEditorStore.getState().setElementSrc("video-auto", "/other.webm"));
    expect(media("video-auto")).toBe(before);
    expect(before.getAttribute("src")).toBe("/other.webm");
    // The native autoplay attribute (still set in Preview) starts the new source.
    expect(before.autoplay).toBe(true);
    expect(callsOn(play, "video-auto")).toBe(1);
  });

  it("unmounting the editor pauses its media", () => {
    const { unmount } = render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    const element = media("video-plain");
    unmount();
    expect(pause.mock.contexts).toContain(element);
  });

  it("playback never touches the document, dirty state or history", () => {
    render(<Workspace />);
    const before = useEditorStore.getState();
    act(() => useEditorStore.getState().enterPreview());
    act(() => useEditorStore.getState().exitPreview());
    const after = useEditorStore.getState();
    expect(after.document).toBe(before.document);
    expect(after.persistedDocument).toBe(before.persistedDocument);
    expect(after.past).toBe(before.past);
    expect(after.future).toBe(before.future);
  });
});
