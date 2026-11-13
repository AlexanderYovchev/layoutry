import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIframeNode, createVideoEmbedNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { InspectorNodeSummary } from "./InspectorNodeSummary";
import { InspectorVideoEmbedSection } from "./InspectorVideoEmbedSection";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const YT = "dQw4w9WgXcQ";
let embedId: string;
const node = () => findNodeById(store().document, embedId)!;

function renderSection() {
  return render(<InspectorVideoEmbedSection node={node()} />);
}

function paste(value: string) {
  const input = screen.getByLabelText("Video URL");
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

beforeEach(() => {
  const embed = createVideoEmbedNode();
  store().insertElement("page-root", embed);
  embedId = embed.id;
});

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("InspectorVideoEmbedSection (BC-08.2)", () => {
  it("an empty Video Embed: a labelled Video URL field, no provider yet, no playback controls", () => {
    renderSection();
    expect(screen.getByLabelText("Video URL")).toHaveValue("");
    expect(screen.getByTestId("video-embed-provider")).toHaveTextContent("None yet");
    expect(screen.queryByRole("switch", { name: "Autoplay" })).toBeNull();
    expect(screen.getByLabelText("Title")).toHaveValue("Embedded video");
  });

  it("detects the provider and shows the canonical link", () => {
    const { rerender } = renderSection();
    paste(`https://youtu.be/${YT}?si=track`);
    rerender(<InspectorVideoEmbedSection node={node()} />);
    expect(screen.getByLabelText("Video URL")).toHaveValue(`https://www.youtube-nocookie.com/embed/${YT}`);
    expect(screen.getByTestId("video-embed-provider")).toHaveTextContent("YouTube");
  });

  it("an invalid link: an announced error, the draft stays, the stored source does not change", () => {
    store().setElementSrc(embedId, `https://www.youtube-nocookie.com/embed/${YT}`);
    const history = store().past.length;
    const { rerender } = renderSection();
    paste("https://youtube.com.evil.example/watch?v=x");
    rerender(<InspectorVideoEmbedSection node={node()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("That isn't a YouTube, Vimeo, Loom or Wistia link.");
    expect(screen.getByLabelText("Video URL")).toHaveValue("https://youtube.com.evil.example/watch?v=x");
    expect(screen.getByLabelText("Video URL")).toHaveAttribute("aria-invalid", "true");
    expect(node().src).toBe(`https://www.youtube-nocookie.com/embed/${YT}`);
    expect(store().past.length).toBe(history);
  });

  it("YouTube offers Muted, Autoplay, Loop, Controls, Start at and Privacy mode", () => {
    store().setElementSrc(embedId, `https://www.youtube-nocookie.com/embed/${YT}`);
    renderSection();
    for (const name of ["Muted", "Autoplay", "Loop", "Controls", "Privacy mode"]) expect(screen.getByRole("switch", { name })).toBeInTheDocument();
    expect(screen.getByLabelText("Start at")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Privacy mode" })).toHaveAttribute("aria-checked", "true");
    // Mute and the nocookie host were confirmed live (BC-08.3): no "not yet confirmed" caveats remain for YouTube.
    expect(screen.queryAllByText("Not yet confirmed with this provider's player.")).toHaveLength(0);
    expect(screen.queryByTestId("video-embed-playback-blocked")).toBeNull();
  });

  it("Vimeo hides Controls and says why", () => {
    store().setElementSrc(embedId, "https://player.vimeo.com/video/76979871?dnt=1");
    renderSection();
    expect(screen.queryByRole("switch", { name: "Controls" })).toBeNull();
    expect(screen.getByText(/Hiding them needs the video owner's paid Vimeo plan/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Loop" })).toBeInTheDocument();
  });

  it("Vimeo: its playback blocker is announced (BC-08.3)", () => {
    store().setElementSrc(embedId, "https://player.vimeo.com/video/76979871?dnt=1");
    renderSection();
    expect(screen.getByTestId("video-embed-playback-blocked")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("video-embed-playback-blocked")).toHaveTextContent(/^Vimeo videos can't play yet: Vimeo's player needs a browser permission \(encrypted media\)/);
  });

  it("Loom says its playback is not yet confirmed (BC-08.3)", () => {
    store().setElementSrc(embedId, `https://www.loom.com/embed/${"a".repeat(32)}`);
    renderSection();
    expect(screen.getByText("Playback hasn't been confirmed with a real Loom video yet.")).toBeInTheDocument();
  });

  it("Loom hides Loop, Controls and Privacy mode and says why", () => {
    store().setElementSrc(embedId, `https://www.loom.com/embed/${"a".repeat(32)}`);
    renderSection();
    for (const name of ["Loop", "Controls", "Privacy mode"]) expect(screen.queryByRole("switch", { name })).toBeNull();
    expect(screen.getByText("Loom videos can't loop.")).toBeInTheDocument();
    expect(screen.getByText("Loom has no privacy-enhanced mode.")).toBeInTheDocument();
  });

  it("muted-only autoplay is explained, and Muted is never switched on for the user", () => {
    store().setElementSrc(embedId, `https://www.youtube-nocookie.com/embed/${YT}`);
    const { rerender } = renderSection();
    expect(screen.getByText(/^Starts by itself only when Muted is also on, and never for visitors who ask for reduced motion./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Autoplay" }));
    rerender(<InspectorVideoEmbedSection node={node()} />);
    expect(node().autoplay).toBe(true);
    expect(node().muted).toBeUndefined();
    expect(screen.getByText("Autoplay won't start until Muted is on. Layoutry only autoplays muted videos.")).toBeInTheDocument();
  });

  it("each toggle is one Undo step", () => {
    store().setElementSrc(embedId, `https://www.youtube-nocookie.com/embed/${YT}`);
    const history = store().past.length;
    renderSection();
    fireEvent.click(screen.getByRole("switch", { name: "Muted" }));
    expect(store().past.length).toBe(history + 1);
    expect(node().muted).toBe(true);
  });

  it("Start at: a valid time is one Undo step in the source; an invalid one is refused", () => {
    store().setElementSrc(embedId, `https://www.youtube-nocookie.com/embed/${YT}`);
    const history = store().past.length;
    const { rerender } = renderSection();
    const start = screen.getByLabelText("Start at");
    fireEvent.change(start, { target: { value: "1:30" } });
    fireEvent.keyDown(start, { key: "Enter" });
    expect(node().src).toBe(`https://www.youtube-nocookie.com/embed/${YT}?start=90`);
    expect(store().past.length).toBe(history + 1);
    rerender(<InspectorVideoEmbedSection node={node()} />);
    const again = screen.getByLabelText("Start at");
    expect(again).toHaveValue("1:30");
    fireEvent.change(again, { target: { value: "soon" } });
    fireEvent.keyDown(again, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a time like 1:30 or 90.");
    expect(node().src).toBe(`https://www.youtube-nocookie.com/embed/${YT}?start=90`);
  });

  it("Privacy mode off switches YouTube to its standard host", () => {
    store().setElementSrc(embedId, `https://www.youtube-nocookie.com/embed/${YT}`);
    renderSection();
    fireEvent.click(screen.getByRole("switch", { name: "Privacy mode" }));
    expect(node().src).toBe(`https://www.youtube.com/embed/${YT}`);
  });
});

describe("InspectorNodeSummary routing", () => {
  it("a Video Embed gets the Video section; a generic Embed keeps the Embed section", () => {
    const { unmount } = render(<InspectorNodeSummary node={node()} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(screen.getByLabelText("Video URL")).toBeInTheDocument();
    expect(screen.queryByLabelText("Source URL")).toBeNull();
    unmount();
    const generic = { ...createIframeNode(), src: `https://www.youtube.com/embed/${YT}` };
    store().insertElement("page-root", generic);
    render(<InspectorNodeSummary node={findNodeById(store().document, generic.id)!} parentId="page-root" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(screen.getByLabelText("Source URL")).toHaveValue(`https://www.youtube.com/embed/${YT}`);
    expect(screen.queryByLabelText("Video URL")).toBeNull();
  });
});
