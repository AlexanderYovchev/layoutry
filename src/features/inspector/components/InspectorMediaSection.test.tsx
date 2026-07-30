import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorMediaSection } from "./InspectorMediaSection";
import type { MediaFitSettings } from "@/features/editor/types/mediaFit";

const initialState = useEditorStore.getState();

// Subscribes to the store so each click sees the freshly-committed node —
// mirrors how the real Inspector re-derives `node` from the document on
// every store change (see useSelectedNode).
function ConnectedSection({ id }: { id: string }) {
  const node = useEditorStore((state) => state.document.children?.find((c) => c.id === id));
  if (!node) return null;
  return <InspectorMediaSection node={node} />;
}

function setup(node: { id: string; tag: string; mediaFit?: MediaFitSettings }) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [{ ...node, children: [] }] },
  }));
  return render(<ConnectedSection id={node.id} />);
}

describe("InspectorMediaSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Contain/Center as the active defaults when mediaFit is unset", () => {
    setup({ id: "image-1", tag: "img" });
    expect(screen.getByRole("button", { name: "Contain" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Center" })).toHaveAttribute("aria-pressed", "true");
  });

  it("changing Fit dispatches setMediaFitSettings", () => {
    setup({ id: "image-1", tag: "img" });
    fireEvent.click(screen.getByRole("button", { name: "Cover" }));

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "image-1");
    expect(node?.mediaFit?.fit).toBe("cover");
    expect(node?.mediaFit?.preserveAspectRatio).toBe(true);
  });

  it("changing Position dispatches setMediaFitSettings without disturbing Fit", () => {
    setup({ id: "image-1", tag: "img", mediaFit: { fit: "cover", position: "center", preserveAspectRatio: true } });
    const positionGroup = screen.getByRole("group", { name: "Position" });
    fireEvent.click(within(positionGroup).getByRole("button", { name: "Top" }));

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "image-1");
    expect(node?.mediaFit).toEqual({ fit: "cover", position: "top", preserveAspectRatio: true });
  });

  it("selecting Fill still keeps preserveAspectRatio true from this UI (Fill is the explicit stretch choice, not a separate toggle)", () => {
    setup({ id: "image-1", tag: "img" });
    fireEvent.click(screen.getByRole("button", { name: "Fill" }));

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "image-1");
    expect(node?.mediaFit).toEqual({ fit: "fill", position: "center", preserveAspectRatio: true });
  });
});
