import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { InspectorInteractionsSection } from "./InspectorInteractionsSection";

const initialState = useEditorStore.getState();

function setupDocument(children: EditorElementNode[]) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children } }));
}

/**
 * The real InspectorNodeSummary always gets `node` from a live store
 * selector (useSelectedNodes), so it re-renders with fresh `interactions`
 * the instant a click adds/changes/removes one. Rendering the section
 * directly with a static prop (as most tests below do, since they only
 * assert on STORE state after the click) would never re-render that way —
 * this wrapper closes that gap for the handful of tests that need to
 * observe the DOM AFTER a click-driven store update.
 */
function LiveInteractionsSection({ nodeId }: { nodeId: string }) {
  const node = useEditorStore((state) => state.document.children?.find((c) => c.id === nodeId));
  // Guards against a stray re-render during test teardown (afterEach
  // resets the store while this is still mounted, briefly pointing at a
  // document that no longer has this fixture node) — not a real
  // production path, since useSelectedNodes already filters stale ids.
  if (!node) return null;
  return <InspectorInteractionsSection node={node} />;
}

describe("InspectorInteractionsSection (Checkpoint 1.15.6.8)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows an 'Add Interaction' affordance for a node with no bindings yet", () => {
    setupDocument([{ id: "button-1", tag: "button", text: "Go" }]);
    render(<InspectorInteractionsSection node={{ id: "button-1", tag: "button", text: "Go" }} />);

    expect(screen.getByRole("button", { name: "Add Interaction" })).toBeInTheDocument();
  });

  it("clicking Add Interaction adds a toggle binding targeting some other existing node", () => {
    setupDocument([
      { id: "button-1", tag: "button", text: "Go" },
      { id: "target-1", tag: "div" },
    ]);
    render(<InspectorInteractionsSection node={{ id: "button-1", tag: "button", text: "Go" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));

    const node = useEditorStore.getState().document.children!.find((c) => c.id === "button-1")!;
    expect(node.interactions).toHaveLength(1);
    expect(node.interactions![0].action).toBe("toggle");
  });

  it("shows Action and Target controls for an existing binding, with the target's human-readable name", () => {
    setupDocument([
      { id: "button-1", tag: "button", text: "Go", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "target-1" }] },
      { id: "target-1", tag: "div" },
    ]);
    render(
      <InspectorInteractionsSection
        node={{ id: "button-1", tag: "button", text: "Go", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "target-1" }] }}
      />,
    );

    expect(screen.getByText("On Click")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Action" })).toHaveValue("toggle");
    const targetSelect = screen.getByRole("combobox", { name: "Target" });
    expect(targetSelect).toHaveValue("target-1");
    expect(screen.getByRole("option", { name: "Container" })).toBeInTheDocument();
  });

  it("changing the Action select commits an update", () => {
    setupDocument([
      { id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "target-1" }] },
      { id: "target-1", tag: "div" },
    ]);
    render(
      <InspectorInteractionsSection
        node={{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "target-1" }] }}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), { target: { value: "hide" } });

    const node = useEditorStore.getState().document.children!.find((c) => c.id === "button-1")!;
    expect(node.interactions![0].action).toBe("hide");
  });

  it("changing the Target select commits an update", () => {
    setupDocument([
      { id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "target-1" }] },
      { id: "target-1", tag: "div" },
      { id: "target-2", tag: "p", text: "Other" },
    ]);
    render(
      <InspectorInteractionsSection
        node={{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "target-1" }] }}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Target" }), { target: { value: "target-2" } });

    const node = useEditorStore.getState().document.children!.find((c) => c.id === "button-1")!;
    expect(node.interactions![0].targetId).toBe("target-2");
  });

  it("removing a binding via its Remove button clears it", () => {
    setupDocument([
      { id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "target-1" }] },
      { id: "target-1", tag: "div" },
    ]);
    render(
      <InspectorInteractionsSection
        node={{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "target-1" }] }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove interaction" }));

    const node = useEditorStore.getState().document.children!.find((c) => c.id === "button-1")!;
    expect(node.interactions).toBeUndefined();
  });

  it("disambiguates duplicate display names in the target picker with a trailing internal id", () => {
    setupDocument([
      { id: "button-1", tag: "button" },
      { id: "div-a", tag: "div" },
      { id: "div-b", tag: "div" },
    ]);
    render(<LiveInteractionsSection nodeId="button-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));

    expect(screen.getByRole("option", { name: "Container (div-a)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Container (div-b)" })).toBeInTheDocument();
  });

  it("shows a defensive 'Missing target' option without crashing when the stored targetId no longer resolves", () => {
    setupDocument([{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "gone" }] }]);
    render(
      <InspectorInteractionsSection
        node={{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "gone" }] }}
      />,
    );

    expect(screen.getByRole("option", { name: "Missing target" })).toBeInTheDocument();
    expect(screen.getByText("Target no longer exists.")).toBeInTheDocument();
  });

  it("excludes the document root itself from the target picker", () => {
    setupDocument([{ id: "button-1", tag: "button" }]);
    const rootId = useEditorStore.getState().document.id;
    render(<LiveInteractionsSection nodeId="button-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));

    const targetSelect = screen.getByRole("combobox", { name: "Target" }) as HTMLSelectElement;
    const optionValues = Array.from(targetSelect.options).map((option) => option.value);
    expect(optionValues).not.toContain(rootId);
  });
});
