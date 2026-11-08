import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { INTERACTION_COPY } from "@/features/inspector/utils/interactionGuidanceCopy";
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

  it("clicking Add Interaction starts a Toggle interaction with no target, and adds nothing to the document until one is chosen (BC-04.2)", () => {
    setupDocument([
      { id: "button-1", tag: "button", text: "Go" },
      { id: "target-1", tag: "div" },
    ]);
    render(<LiveInteractionsSection nodeId="button-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));

    expect(useEditorStore.getState().document.children!.find((c) => c.id === "button-1")!.interactions).toBeUndefined();
    expect(screen.getByRole("combobox", { name: "Action" })).toHaveValue("toggle");
    expect(screen.getByRole("combobox", { name: "Target" })).toHaveValue("");
    expect(screen.getByRole("option", { name: INTERACTION_COPY.targetPlaceholder })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Target" }), { target: { value: "target-1" } });

    const node = useEditorStore.getState().document.children!.find((c) => c.id === "button-1")!;
    expect(node.interactions).toEqual([{ id: expect.any(String), trigger: "click", action: "toggle", targetId: "target-1" }]);
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

  it("tells duplicate display names apart without internal ids (BC-04.2)", () => {
    setupDocument([
      { id: "button-1", tag: "button" },
      { id: "div-a", tag: "div" },
      { id: "div-b", tag: "div" },
    ]);
    render(<LiveInteractionsSection nodeId="button-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));

    expect(screen.getByRole("option", { name: "Container (1 of 2)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Container (2 of 2)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /div-a/ })).not.toBeInTheDocument();
  });

  it("shows a defensive 'Missing target' option without crashing when the stored targetId no longer resolves", () => {
    setupDocument([{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "gone" }] }]);
    render(
      <InspectorInteractionsSection
        node={{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "gone" }] }}
      />,
    );

    expect(screen.getByRole("option", { name: "Missing target" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(INTERACTION_COPY.missingTarget);
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

  describe("Initial state control (Checkpoint 1.15.6.8.1)", () => {
    it("shows 'Visible' by default, even for a node with zero interaction bindings", () => {
      setupDocument([{ id: "div-1", tag: "div" }]);
      render(<InspectorInteractionsSection node={{ id: "div-1", tag: "div" }} />);

      expect(screen.getByRole("combobox", { name: "Initial state" })).toHaveValue("visible");
    });

    it("reflects an already-authored 'hidden' value", () => {
      setupDocument([{ id: "div-1", tag: "div", initialPreviewVisibility: "hidden" }]);
      render(<InspectorInteractionsSection node={{ id: "div-1", tag: "div", initialPreviewVisibility: "hidden" }} />);

      expect(screen.getByRole("combobox", { name: "Initial state" })).toHaveValue("hidden");
    });

    it("changing Initial state to Hidden commits it through the store", () => {
      setupDocument([{ id: "div-1", tag: "div" }]);
      render(<InspectorInteractionsSection node={{ id: "div-1", tag: "div" }} />);

      fireEvent.change(screen.getByRole("combobox", { name: "Initial state" }), { target: { value: "hidden" } });

      const node = useEditorStore.getState().document.children!.find((c) => c.id === "div-1")!;
      expect(node.initialPreviewVisibility).toBe("hidden");
    });

    it("changing Initial state back to Visible clears the field to undefined, not an explicit 'visible' string", () => {
      setupDocument([{ id: "div-1", tag: "div", initialPreviewVisibility: "hidden" }]);
      render(<InspectorInteractionsSection node={{ id: "div-1", tag: "div", initialPreviewVisibility: "hidden" }} />);

      fireEvent.change(screen.getByRole("combobox", { name: "Initial state" }), { target: { value: "visible" } });

      const node = useEditorStore.getState().document.children!.find((c) => c.id === "div-1")!;
      expect(node.initialPreviewVisibility).toBeUndefined();
    });

    it("is present and usable for a node that is a pure interaction TARGET with no bindings of its own (the Dropdown menu's own shape)", () => {
      setupDocument([{ id: "menu-1", tag: "div", initialPreviewVisibility: "hidden" }]);
      render(<InspectorInteractionsSection node={{ id: "menu-1", tag: "div", initialPreviewVisibility: "hidden" }} />);

      expect(screen.getByRole("combobox", { name: "Initial state" })).toHaveValue("hidden");
      expect(screen.getByRole("button", { name: "Add Interaction" })).toBeInTheDocument();
    });
  });
  describe("Guidance and explicit target selection (BC-04.2)", () => {
    const binding = { id: "int-1", trigger: "click", action: "toggle", targetId: "panel-1" } as const;

    function buttonNode() {
      return useEditorStore.getState().document.children!.find((c) => c.id === "button-1")!;
    }

    it("shows the section description, and help on Initial state, Action and Target that describes each control", () => {
      setupDocument([{ id: "button-1", tag: "button", interactions: [binding] }, { id: "panel-1", tag: "div" }]);
      render(<LiveInteractionsSection nodeId="button-1" />);

      expect(screen.getByText(INTERACTION_COPY.description)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: INTERACTION_COPY.initialStateHelp })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: INTERACTION_COPY.actionHelp })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: INTERACTION_COPY.targetHelp })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Initial state" })).toHaveAccessibleDescription(INTERACTION_COPY.initialStateHelp);
      expect(screen.getByRole("combobox", { name: "Action" })).toHaveAccessibleDescription(INTERACTION_COPY.actionHelp);
      expect(screen.getByRole("combobox", { name: "Target" })).toHaveAccessibleDescription(INTERACTION_COPY.targetHelp);
    });

    it("shows the initially-hidden note only while Initial state is Hidden", () => {
      setupDocument([{ id: "panel-1", tag: "div" }]);
      render(<LiveInteractionsSection nodeId="panel-1" />);
      expect(screen.queryByText(INTERACTION_COPY.initialHiddenNote)).not.toBeInTheDocument();

      fireEvent.change(screen.getByRole("combobox", { name: "Initial state" }), { target: { value: "hidden" } });
      expect(screen.getByText(INTERACTION_COPY.initialHiddenNote)).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Initial state" })).toHaveAccessibleDescription(
        `${INTERACTION_COPY.initialStateHelp} ${INTERACTION_COPY.initialHiddenNote}`,
      );

      fireEvent.change(screen.getByRole("combobox", { name: "Initial state" }), { target: { value: "visible" } });
      expect(screen.queryByText(INTERACTION_COPY.initialHiddenNote)).not.toBeInTheDocument();
    });

    it.each(["h1", "p", "div", "section", "img", "li"])("shows the keyboard note for a <%s> trigger with an interaction", (tag) => {
      setupDocument([{ id: "button-1", tag, interactions: [binding] }, { id: "panel-1", tag: "div" }]);
      render(<LiveInteractionsSection nodeId="button-1" />);
      expect(screen.getByText(INTERACTION_COPY.keyboardNote)).toBeInTheDocument();
    });

    it.each(["button", "a", "input", "select", "textarea"])("never shows the keyboard note for a <%s> trigger", (tag) => {
      setupDocument([{ id: "button-1", tag, interactions: [binding] }, { id: "panel-1", tag: "div" }]);
      render(<LiveInteractionsSection nodeId="button-1" />);
      expect(screen.queryByText(INTERACTION_COPY.keyboardNote)).not.toBeInTheDocument();
    });

    it("shows the keyboard note while a new interaction is set up, and hides it once no interaction is left", () => {
      setupDocument([{ id: "button-1", tag: "h1", text: "Title" }, { id: "panel-1", tag: "div" }]);
      render(<LiveInteractionsSection nodeId="button-1" />);
      expect(screen.queryByText(INTERACTION_COPY.keyboardNote)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));
      expect(screen.getByText(INTERACTION_COPY.keyboardNote)).toBeInTheDocument();

      fireEvent.change(screen.getByRole("combobox", { name: "Target" }), { target: { value: "panel-1" } });
      expect(screen.getByText(INTERACTION_COPY.keyboardNote)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Remove interaction" }));
      expect(screen.queryByText(INTERACTION_COPY.keyboardNote)).not.toBeInTheDocument();
    });

    it("a new interaction asks for its target, keeps the chosen Action, and is added as one Undo step", () => {
      setupDocument([{ id: "button-1", tag: "button" }, { id: "panel-1", tag: "div" }]);
      render(<LiveInteractionsSection nodeId="button-1" />);
      const historyBefore = useEditorStore.getState().past.length;

      fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));
      const target = screen.getByRole("combobox", { name: "Target" });
      expect(target).toHaveAttribute("aria-required", "true");
      expect(target).toHaveAccessibleDescription(`${INTERACTION_COPY.targetRequired} ${INTERACTION_COPY.targetHelp}`);
      expect(screen.queryByRole("button", { name: "Add Interaction" })).not.toBeInTheDocument();

      fireEvent.change(screen.getByRole("combobox", { name: "Action" }), { target: { value: "hide" } });
      expect(useEditorStore.getState().past.length).toBe(historyBefore);
      expect(buttonNode().interactions).toBeUndefined();

      fireEvent.change(target, { target: { value: "panel-1" } });
      expect(buttonNode().interactions).toEqual([{ id: expect.any(String), trigger: "click", action: "hide", targetId: "panel-1" }]);
      expect(useEditorStore.getState().past.length).toBe(historyBefore + 1);
      expect(screen.queryByText(INTERACTION_COPY.targetRequired)).not.toBeInTheDocument();

      act(() => useEditorStore.getState().undo());
      expect(buttonNode().interactions).toBeUndefined();
      expect(screen.getByRole("button", { name: "Add Interaction" })).toBeInTheDocument();

      act(() => useEditorStore.getState().redo());
      expect(screen.getByRole("combobox", { name: "Target" })).toHaveValue("panel-1");
    });

    it("discarding an unfinished interaction changes nothing and returns focus to Add Interaction", () => {
      setupDocument([{ id: "button-1", tag: "button" }, { id: "panel-1", tag: "div" }]);
      render(<LiveInteractionsSection nodeId="button-1" />);
      const before = useEditorStore.getState().document;

      fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));
      expect(screen.getByRole("combobox", { name: "Target" })).toHaveFocus();

      fireEvent.click(screen.getByRole("button", { name: "Remove interaction" }));
      expect(useEditorStore.getState().document).toBe(before);
      expect(screen.getByRole("button", { name: "Add Interaction" })).toHaveFocus();
    });

    it("keeps focus on the finished interaction's Target, and on Add Interaction after a removal", () => {
      setupDocument([{ id: "button-1", tag: "button" }, { id: "panel-1", tag: "div" }]);
      render(<LiveInteractionsSection nodeId="button-1" />);

      fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));
      fireEvent.change(screen.getByRole("combobox", { name: "Target" }), { target: { value: "panel-1" } });
      expect(screen.getByRole("combobox", { name: "Target" })).toHaveFocus();

      fireEvent.click(screen.getByRole("button", { name: "Remove interaction" }));
      expect(screen.getByRole("button", { name: "Add Interaction" })).toHaveFocus();
    });

    it("keeps several interactions independent: a new one never changes an existing one", () => {
      setupDocument([
        { id: "button-1", tag: "button", interactions: [binding] },
        { id: "panel-1", tag: "div" },
        { id: "panel-2", tag: "p", text: "Note" },
      ]);
      render(<LiveInteractionsSection nodeId="button-1" />);

      fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));
      const draftTarget = screen.getAllByRole("combobox", { name: "Target" })[1];
      fireEvent.change(draftTarget, { target: { value: "panel-2" } });
      fireEvent.change(screen.getAllByRole("combobox", { name: "Action" })[0], { target: { value: "show" } });

      expect(buttonNode().interactions).toEqual([
        { ...binding, action: "show" },
        { id: expect.any(String), trigger: "click", action: "toggle", targetId: "panel-2" },
      ]);
    });

    it("drops an unfinished interaction when a different element is shown", () => {
      setupDocument([{ id: "button-1", tag: "button" }, { id: "panel-1", tag: "div" }]);
      const { rerender } = render(<LiveInteractionsSection nodeId="button-1" />);
      fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));

      rerender(<LiveInteractionsSection nodeId="panel-1" />);
      expect(screen.queryByRole("combobox", { name: "Target" })).not.toBeInTheDocument();
      rerender(<LiveInteractionsSection nodeId="button-1" />);
      expect(screen.queryByRole("combobox", { name: "Target" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add Interaction" })).toBeInTheDocument();
    });

    it("keeps an existing interaction's target exactly as saved", () => {
      setupDocument([{ id: "panel-1", tag: "div" }, { id: "button-1", tag: "button", interactions: [binding] }]);
      render(<LiveInteractionsSection nodeId="button-1" />);
      expect(screen.getByRole("combobox", { name: "Target" })).toHaveValue("panel-1");
      expect(buttonNode().interactions).toEqual([binding]);
    });

    it("names targets by their text when names repeat, and marks the selected element itself", () => {
      setupDocument([
        { id: "button-1", tag: "button", text: "Show details" },
        { id: "button-2", tag: "button", text: "A very long label that goes on and on" },
        { id: "panel-1", tag: "div" },
      ]);
      render(<LiveInteractionsSection nodeId="button-1" />);
      fireEvent.click(screen.getByRole("button", { name: "Add Interaction" }));

      expect(screen.getByRole("option", { name: "Button — Show details (this element)" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Button — A very long label that…" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Container" })).toBeInTheDocument();
    });

    it("a missing target can be repaired by choosing a replacement, and is never silently replaced", () => {
      const dangling = { id: "int-1", trigger: "click", action: "show", targetId: "gone" } as const;
      setupDocument([{ id: "button-1", tag: "button", interactions: [dangling] }, { id: "panel-1", tag: "div" }]);
      render(<LiveInteractionsSection nodeId="button-1" />);

      const target = screen.getByRole("combobox", { name: "Target" });
      expect(target).toHaveValue("");
      expect(target).toBeInvalid();
      expect(target).toHaveAccessibleDescription(`${INTERACTION_COPY.targetHelp} ${INTERACTION_COPY.missingTarget}`);
      expect(screen.getByRole("option", { name: "Missing target" })).toBeDisabled();
      expect(buttonNode().interactions).toEqual([dangling]);

      fireEvent.change(target, { target: { value: "panel-1" } });
      expect(buttonNode().interactions).toEqual([{ ...dangling, targetId: "panel-1" }]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
