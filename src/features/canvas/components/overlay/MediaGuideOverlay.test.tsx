import { render } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { MediaGuideOverlay } from "./MediaGuideOverlay";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

function setDocument(children: EditorElementNode[]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children },
  }));
}

function Harness({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      {children}
      <MediaGuideOverlay canvasRootRef={ref} />
    </div>
  );
}

function stubLargeRect() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 200,
    bottom: 150,
    width: 200,
    height: 150,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe("MediaGuideOverlay (Checkpoint 1.15)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("shows the 'Video / Add a source URL' hint for a sourceless Video", () => {
    stubLargeRect();
    setDocument([{ id: "video-1", tag: "video" }]);

    render(
      <Harness>
        <div data-node-id="video-1" />
      </Harness>,
    );

    const guide = document.querySelector('[data-canvas-overlay="media-guide"]');
    expect(guide).toBeInTheDocument();
    expect(guide).toHaveTextContent("Video");
    expect(guide).toHaveTextContent("Add a source URL");
  });

  it("shows the 'Embed / Add a source URL' hint for a sourceless Iframe", () => {
    stubLargeRect();
    setDocument([{ id: "iframe-1", tag: "iframe", title: "Embedded content" }]);

    render(
      <Harness>
        <div data-node-id="iframe-1" />
      </Harness>,
    );

    const guide = document.querySelector('[data-canvas-overlay="media-guide"]');
    expect(guide).toBeInTheDocument();
    expect(guide).toHaveTextContent("Embed");
    expect(guide).toHaveTextContent("Add a source URL");
  });

  it("Checkpoint 1.15.6.12.3 — shows the 'Audio / Add a source URL' hint for a sourceless Audio", () => {
    stubLargeRect();
    setDocument([{ id: "audio-1", tag: "audio" }]);

    render(
      <Harness>
        <div data-node-id="audio-1" />
      </Harness>,
    );

    const guide = document.querySelector('[data-canvas-overlay="media-guide"]');
    expect(guide).toBeInTheDocument();
    expect(guide).toHaveTextContent("Audio");
    expect(guide).toHaveTextContent("Add a source URL");
  });

  it("Checkpoint 1.15.6.12.3 — does not show a hint once an Audio has a src", () => {
    stubLargeRect();
    setDocument([{ id: "audio-1", tag: "audio", src: "https://example.com/audio.mp3" }]);

    render(
      <Harness>
        <div data-node-id="audio-1" />
      </Harness>,
    );

    expect(document.querySelector('[data-canvas-overlay="media-guide"]')).not.toBeInTheDocument();
  });

  it("does not show a hint once a Video has a src", () => {
    stubLargeRect();
    setDocument([{ id: "video-1", tag: "video", src: "https://example.com/video.mp4" }]);

    render(
      <Harness>
        <div data-node-id="video-1" />
      </Harness>,
    );

    expect(document.querySelector('[data-canvas-overlay="media-guide"]')).not.toBeInTheDocument();
  });

  it("does not show a hint once an Iframe has a src", () => {
    stubLargeRect();
    setDocument([{ id: "iframe-1", tag: "iframe", src: "https://example.com/embed" }]);

    render(
      <Harness>
        <div data-node-id="iframe-1" />
      </Harness>,
    );

    expect(document.querySelector('[data-canvas-overlay="media-guide"]')).not.toBeInTheDocument();
  });

  it("does not render a guide for a non-media node", () => {
    stubLargeRect();
    setDocument([{ id: "div-1", tag: "div", children: [] }]);

    render(
      <Harness>
        <div data-node-id="div-1" />
      </Harness>,
    );

    expect(document.querySelector('[data-canvas-overlay="media-guide"]')).not.toBeInTheDocument();
  });

  it("renders one guide per sourceless media node, including nested ones", () => {
    stubLargeRect();
    setDocument([
      { id: "video-1", tag: "video" },
      { id: "section-1", tag: "section", children: [{ id: "iframe-1", tag: "iframe" }] },
    ]);

    render(
      <Harness>
        <div data-node-id="video-1" />
        <div data-node-id="section-1">
          <div data-node-id="iframe-1" />
        </div>
      </Harness>,
    );

    expect(document.querySelectorAll('[data-canvas-overlay="media-guide"]')).toHaveLength(2);
  });

  it("is pointer-safe and never mutates the document model — purely presentational", () => {
    stubLargeRect();
    setDocument([{ id: "video-1", tag: "video" }]);
    const documentBefore = useEditorStore.getState().document;

    render(
      <Harness>
        <div data-node-id="video-1" />
      </Harness>,
    );

    expect(useEditorStore.getState().document).toBe(documentBefore);
  });
});
