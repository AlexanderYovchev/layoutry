import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorNoticeBanner } from "./EditorNoticeBanner";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

const initialState = useEditorStore.getState();

describe("EditorNoticeBanner", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
    vi.useRealTimers();
  });

  it("renders nothing when there is no notice", () => {
    const { container } = render(<EditorNoticeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current notice message", () => {
    useEditorStore.getState().showEditorNotice("Styles are locked by \"hero\".");
    render(<EditorNoticeBanner />);
    expect(screen.getByRole("status")).toHaveTextContent('Styles are locked by "hero".');
  });

  it("auto-dismisses after the timeout", () => {
    vi.useFakeTimers();
    useEditorStore.getState().showEditorNotice("hello");
    render(<EditorNoticeBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4001);
    });

    expect(useEditorStore.getState().editorNotice).toBeNull();
  });

  it("replaces the message when a new notice is shown, without stacking", () => {
    useEditorStore.getState().showEditorNotice("first");
    render(<EditorNoticeBanner />);
    act(() => {
      useEditorStore.getState().showEditorNotice("second");
    });
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("second");
  });
});
