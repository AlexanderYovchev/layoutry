import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorHeadingLevelSection } from "./InspectorHeadingLevelSection";

const initialState = useEditorStore.getState();

function ConnectedSection({ id }: { id: string }) {
  const node = useEditorStore((state) => state.document.children?.find((c) => c.id === id));
  if (!node) return null;
  return <InspectorHeadingLevelSection node={node} />;
}

function setup(node: { id: string; tag: string; text?: string }) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [{ ...node }] },
  }));
  return render(<ConnectedSection id={node.id} />);
}

function currentNode(id: string) {
  return useEditorStore.getState().document.children?.find((c) => c.id === id);
}

describe("InspectorHeadingLevelSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows all six levels with the node's current level active", () => {
    setup({ id: "heading-1", tag: "h3", text: "Subtitle" });

    for (const level of ["H1", "H2", "H3", "H4", "H5", "H6"]) {
      expect(screen.getByRole("button", { name: level })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "H3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "H1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("commits the new tag through setElementTag when a different level is selected", () => {
    setup({ id: "heading-1", tag: "h1", text: "Title" });

    screen.getByRole("button", { name: "H2" }).click();

    expect(currentNode("heading-1")?.tag).toBe("h2");
  });

  it("preserves text when the level changes", () => {
    setup({ id: "heading-1", tag: "h1", text: "Pricing" });

    screen.getByRole("button", { name: "H4" }).click();

    expect(currentNode("heading-1")?.text).toBe("Pricing");
  });

  it("does not push a history entry when re-selecting the already-active level", () => {
    setup({ id: "heading-1", tag: "h2", text: "Title" });
    const pastLengthBefore = useEditorStore.getState().past.length;

    screen.getByRole("button", { name: "H2" }).click();

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });
});
