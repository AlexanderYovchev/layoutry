import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selectHasUnsavedChanges, useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getFlexChildSettings } from "@/features/editor/types/flowLayout";
import { getElementSpacing } from "@/features/editor/types/spacing";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { InspectorBackgroundSection } from "@/features/inspector/components/InspectorBackgroundSection";
import { InspectorBorderSection } from "@/features/inspector/components/InspectorBorderSection";
import { InspectorFiltersSection } from "@/features/inspector/components/InspectorFiltersSection";
import { InspectorFlexChildSection } from "@/features/inspector/components/InspectorFlexChildSection";
import { InspectorSpacingSection } from "@/features/inspector/components/InspectorSpacingSection";
import { InspectorTypographySection } from "@/features/inspector/components/InspectorTypographySection";

/**
 * BC-01.3 — live numeric Inspector editing, exercised through real
 * Inspector sections against the real editor store. The harness renders
 * the section for whatever the store currently selects, the way
 * InspectorNodeSummary does, so selection changes reuse the same field
 * instances exactly as in the app.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id);
const fontSize = (id = "heading-1") => node(id)?.typography?.fontSize?.value;
const history = () => store().past.length;

function Selected({ section: Section }: { section: ComponentType<{ node: EditorElementNode }> }) {
  const selected = useEditorStore((state) => (state.selection.primaryId ? findNodeById(state.document, state.selection.primaryId) : undefined));
  return selected ? <Section node={selected} /> : null;
}

function type(input: HTMLElement, ...drafts: string[]) {
  for (const draft of drafts) fireEvent.change(input, { target: { value: draft } });
}

function focus(input: HTMLElement) {
  act(() => input.focus());
}

function blur(input: HTMLElement) {
  act(() => input.blur());
}

beforeEach(() => {
  useEditorStore.setState(initialState, true);
  useEditorStore.setState({ persistedDocument: store().document });
  store().selectOnly("heading-1");
});

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("live numeric editing (BC-01.3)", () => {
  it("writes each valid draft to the document before blur, keeps focus, and records one entry on Enter; Undo/Redo step over the whole edit", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);

    type(input, "2");
    expect(fontSize()).toBe(2);
    type(input, "24", "32");
    expect(fontSize()).toBe(32);
    expect(input).toHaveFocus();
    expect(history()).toBe(0);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(history()).toBe(1);
    expect(store().transactionSnapshot).toBeNull();

    act(() => store().undo());
    expect(node("heading-1")?.typography).toBeUndefined();
    expect(input).toHaveValue(16);
    act(() => store().redo());
    expect(fontSize()).toBe(32);
    expect(input).toHaveValue(32);
  });

  it("blur commits the edit exactly once", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "40");
    blur(input);

    expect(fontSize()).toBe(40);
    expect(history()).toBe(1);
    focus(input);
    blur(input);
    expect(history()).toBe(1);
  });

  it("keeps the typed text verbatim while the document holds the parsed value (no mid-edit reformatting)", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Line height");
    focus(input);
    type(input, "1.50");

    expect(node("heading-1")?.typography?.lineHeight?.value).toBe(1.5);
    expect(input).toHaveDisplayValue("1.50");
  });

  it("Escape restores an unset property to unset: no history, project clean, transaction closed", () => {
    render(<Selected section={InspectorTypographySection} />);
    const documentBefore = store().document;
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "48");
    expect(fontSize()).toBe(48);

    fireEvent.keyDown(input, { key: "Escape" });

    expect(store().document).toBe(documentBefore);
    expect(node("heading-1")?.typography).toBeUndefined();
    expect(history()).toBe(0);
    expect(store().transactionSnapshot).toBeNull();
    expect(selectHasUnsavedChanges(store())).toBe(false);
    expect(input).toHaveValue(16);
  });

  it("Escape clears a transient validation message", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "-3");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a font size greater than 0.");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("focus, blur and Enter without an edit touch nothing", () => {
    render(<Selected section={InspectorTypographySection} />);
    const documentBefore = store().document;
    const input = screen.getByLabelText("Font size");
    focus(input);
    blur(input);
    focus(input);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(store().document).toBe(documentBefore);
    expect(history()).toBe(0);
    expect(store().transactionSnapshot).toBeNull();
  });

  it("an edit that ends on the original explicit value records nothing and leaves the project clean", () => {
    act(() => store().setElementTypography("heading-1", { fontSize: { value: 20, unit: "px" } }));
    useEditorStore.setState({ past: [], persistedDocument: store().document });
    const documentBefore = store().document;
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "30", "20");
    blur(input);

    expect(history()).toBe(0);
    expect(store().document).toBe(documentBefore);
    expect(selectHasUnsavedChanges(store())).toBe(false);
  });

  it("an invalid intermediate value is never written; the edit continues to a valid final value", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "24", "0");
    expect(fontSize()).toBe(24);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    type(input, "0.5");
    expect(fontSize()).toBe(0.5);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(history()).toBe(1);
  });

  it("an invalid final draft reverts the whole edit instead of keeping an intermediate preview", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "24", "-5");
    expect(fontSize()).toBe(24);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(node("heading-1")?.typography).toBeUndefined();
    expect(history()).toBe(0);
    expect(store().transactionSnapshot).toBeNull();
    expect(input).toHaveValue(16);
    // The message stays: it explains why the field just reverted.
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a font size greater than 0.");
  });

  it("an emptied final draft reverts too (font size has no 'auto')", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "24", "");
    blur(input);

    expect(node("heading-1")?.typography).toBeUndefined();
    expect(history()).toBe(0);
  });

  it("a programmatic selection change mid-edit commits to the ORIGINAL element; later typing edits the new one separately", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "40");

    act(() => store().selectOnly("paragraph-1"));
    expect(fontSize("heading-1")).toBe(40);
    expect(node("paragraph-1")?.typography).toBeUndefined();
    expect(history()).toBe(1);
    expect(store().transactionSnapshot).toBeNull();
    expect(screen.getByLabelText("Font size")).toHaveValue(16);

    // The input never lost focus: the next keystroke starts a fresh edit on the paragraph.
    type(screen.getByLabelText("Font size"), "18");
    expect(fontSize("paragraph-1")).toBe(18);
    expect(fontSize("heading-1")).toBe(40);
    blur(screen.getByLabelText("Font size"));
    expect(history()).toBe(2);
  });

  it("a selection change to an element with the SAME value still ends the edit on the original (the BC-01.2 known limitation)", () => {
    render(<Selected section={InspectorSpacingSection} />);
    const input = screen.getAllByLabelText("Padding (all sides)")[0];
    focus(input);
    // Out of range: not previewed, so both elements still read padding 0.
    type(input, "99999");
    act(() => store().selectOnly("paragraph-1"));
    blur(screen.getAllByLabelText("Padding (all sides)")[0]);

    const heading = node("heading-1");
    const paragraph = node("paragraph-1");
    expect(heading && getElementSpacing(heading).padding.top).toBe(500);
    expect(paragraph && getElementSpacing(paragraph).padding.top).toBe(0);
    expect(history()).toBe(1);
    expect(screen.getAllByLabelText("Padding (all sides)")[0]).toHaveValue(0);
  });

  it("unmounting mid-edit commits and closes the transaction", () => {
    const { unmount } = render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "44");
    unmount();

    expect(fontSize()).toBe(44);
    expect(history()).toBe(1);
    expect(store().transactionSnapshot).toBeNull();
  });

  it("a pointerdown elsewhere ends the edit BEFORE another gesture can open its transaction", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "44");

    act(() => {
      fireEvent.pointerDown(document.body);
      store().beginResizeTransaction();
    });
    expect(history()).toBe(1);
    expect(store().transactionSnapshot).not.toBeNull();
    expect(store().historyMergeSnapshot).toBeNull();
    act(() => store().commitResizeTransaction());
    expect(history()).toBe(2);
  });

  it("a pointerdown inside the field itself (moving the caret) does not end the edit", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "44");
    fireEvent.pointerDown(input);

    expect(store().transactionSnapshot).not.toBeNull();
    type(input, "45");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(fontSize()).toBe(45);
    expect(history()).toBe(1);
  });

  it("never joins another gesture's open transaction: it falls back to one commit at the end and leaves that transaction alone", () => {
    render(<Selected section={InspectorTypographySection} />);
    act(() => store().beginTransaction());
    const gesture = store().transactionSnapshot;
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "50");
    expect(fontSize()).toBeUndefined();

    blur(input);
    expect(fontSize()).toBe(50);
    expect(store().transactionSnapshot).toBe(gesture);
    expect(store().historyMergeSnapshot).toBeNull();
  });

  it("rapid typing loses no update and is still one entry", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "1", "12", "123", "12", "1", "17", "172");
    expect(fontSize()).toBe(172);
    blur(input);

    expect(fontSize()).toBe(172);
    expect(history()).toBe(1);
  });

  it("Arrow steps join the same live edit (one entry for the whole session)", () => {
    render(<Selected section={InspectorSpacingSection} />);
    const input = screen.getAllByLabelText("Padding (all sides)")[0];
    focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const heading = node("heading-1");
    expect(heading && getElementSpacing(heading).padding.top).toBe(3);
    expect(history()).toBe(0);

    blur(input);
    expect(history()).toBe(1);
  });

  it("an out-of-range draft is not previewed; the existing clamp applies at commit", () => {
    render(<Selected section={InspectorSpacingSection} />);
    const input = screen.getAllByLabelText("Padding (all sides)")[0];
    focus(input);
    type(input, "40", "99999");
    let heading = node("heading-1");
    expect(heading && getElementSpacing(heading).padding.top).toBe(40);

    blur(input);
    heading = node("heading-1");
    expect(heading && getElementSpacing(heading).padding.top).toBe(500);
    expect(history()).toBe(1);
  });

  it("a project shortcut (Ctrl+S) mid-edit commits the edit first, so the save finds no open transaction and stores the value", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "36");
    expect(store().transactionSnapshot).not.toBeNull();

    let transactionSeenBySave: unknown = "not called";
    function projectSaveListener() {
      transactionSeenBySave = store().transactionSnapshot;
      store().markDocumentPersisted(store().document);
    }
    window.addEventListener("keydown", projectSaveListener);
    try {
      fireEvent.keyDown(input, { key: "s", ctrlKey: true });
    } finally {
      window.removeEventListener("keydown", projectSaveListener);
    }

    expect(transactionSeenBySave).toBeNull();
    expect(fontSize()).toBe(36);
    expect(history()).toBe(1);
    expect(selectHasUnsavedChanges(store())).toBe(false);
    expect(input).toHaveFocus();

    // A later, cancelled edit restores the exact saved document: still clean.
    type(input, "38");
    expect(selectHasUnsavedChanges(store())).toBe(true);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(fontSize()).toBe(36);
    expect(selectHasUnsavedChanges(store())).toBe(false);
  });

  it("ordinary editing shortcuts inside the field (Ctrl+A, Ctrl+Z) do not end the edit", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Font size");
    focus(input);
    type(input, "36");
    fireEvent.keyDown(input, { key: "a", ctrlKey: true });
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });

    expect(store().transactionSnapshot).not.toBeNull();
    expect(history()).toBe(0);
  });

  it("InspectorNumberFieldRow rows that opt in (Flex child Grow) are live too", () => {
    render(<Selected section={InspectorFlexChildSection} />);
    const input = screen.getByLabelText("Grow");
    focus(input);
    type(input, "2");
    const heading = node("heading-1");
    expect(heading && getFlexChildSettings(heading).grow).toBe(2);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(history()).toBe(1);
  });

  it("the slider's exact-value box is live, and a later slider drag is still its own single entry", () => {
    render(<Selected section={InspectorFiltersSection} />);
    const input = screen.getByLabelText("Opacity (exact value)");
    focus(input);
    type(input, "4", "40");
    expect(node("heading-1")?.filters?.opacity).toBe(40);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(history()).toBe(1);

    const slider = screen.getByRole("slider", { name: "Opacity" });
    fireEvent.input(slider, { target: { value: "30" } });
    fireEvent.change(slider, { target: { value: "30" } });
    expect(node("heading-1")?.filters?.opacity).toBe(30);
    expect(history()).toBe(2);
  });
});

describe("live color text editing (BC-01.4)", () => {
  const textColor = (id = "heading-1") => node(id)?.typography?.color;

  it("a valid color reaches the document before blur, focus is kept, and Enter records one entry; Undo/Redo", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Text color");
    focus(input);
    type(input, "#", "#f", "#ff", "#ff0");
    expect(textColor()).toBe("#ff0");
    type(input, "#ff00", "#ff000", "#ff0000");
    expect(textColor()).toBe("#ff0000");
    expect(input).toHaveFocus();
    expect(history()).toBe(0);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(history()).toBe(1);
    act(() => store().undo());
    expect(node("heading-1")?.typography).toBeUndefined();
    expect(input).toHaveValue("");
    act(() => store().redo());
    expect(textColor()).toBe("#ff0000");
    expect(input).toHaveValue("#ff0000");
  });

  it("invalid or half-typed text never touches the document", () => {
    render(<Selected section={InspectorTypographySection} />);
    const documentBefore = store().document;
    const input = screen.getByLabelText("Text color");
    focus(input);
    type(input, "#", "#1", "#12", "rgb(1, 2", "red", "hsl(10, 50");

    expect(store().document).toBe(documentBefore);
    expect(store().transactionSnapshot).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Escape restores an unset color to unset, and an authored color to that color — no history, clean", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Text color");
    focus(input);
    type(input, "#00ff00");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(node("heading-1")?.typography).toBeUndefined();
    expect(history()).toBe(0);
    expect(selectHasUnsavedChanges(store())).toBe(false);

    act(() => store().setElementTypography("heading-1", { color: "#123456" }));
    useEditorStore.setState({ past: [], persistedDocument: store().document });
    focus(input);
    type(input, "#abcdef");
    expect(textColor()).toBe("#abcdef");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(textColor()).toBe("#123456");
    expect(input).toHaveValue("#123456");
    expect(history()).toBe(0);
    expect(selectHasUnsavedChanges(store())).toBe(false);
  });

  it("blur commits once; focus/blur without an edit, and retyping the same color, record nothing", () => {
    act(() => store().setElementTypography("heading-1", { color: "#123456" }));
    useEditorStore.setState({ past: [], persistedDocument: store().document });
    const documentBefore = store().document;
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Text color");

    focus(input);
    blur(input);
    focus(input);
    type(input, "#000000", "#123456");
    blur(input);
    expect(history()).toBe(0);
    expect(store().document).toBe(documentBefore);

    focus(input);
    type(input, "rgba(0, 0, 0, 0.5)");
    blur(input);
    expect(textColor()).toBe("rgba(0, 0, 0, 0.5)");
    expect(history()).toBe(1);
  });

  it("an invalid final draft reverts the whole edit (and the field) instead of keeping an intermediate color", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Text color");
    focus(input);
    type(input, "#ff0000", "#ff00zz");
    expect(textColor()).toBe("#ff0000");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(node("heading-1")?.typography).toBeUndefined();
    expect(history()).toBe(0);
    expect(store().transactionSnapshot).toBeNull();
    expect(input).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a hex color");

    // Escape on the next edit clears that message.
    focus(input);
    type(input, "#0");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a programmatic selection change mid-edit commits the color to the original element only", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Text color");
    focus(input);
    type(input, "#ff0000");
    act(() => store().selectOnly("paragraph-1"));

    expect(textColor("heading-1")).toBe("#ff0000");
    expect(node("paragraph-1")?.typography).toBeUndefined();
    expect(history()).toBe(1);
    expect(screen.getByLabelText("Text color")).toHaveValue("");
  });

  it("Ctrl+S mid-edit commits the color first, so the save finds no open transaction", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Text color");
    focus(input);
    type(input, "#ff0000");
    let transactionSeenBySave: unknown = "not called";
    const listener = () => {
      transactionSeenBySave = store().transactionSnapshot;
    };
    window.addEventListener("keydown", listener);
    try {
      fireEvent.keyDown(input, { key: "s", ctrlKey: true });
    } finally {
      window.removeEventListener("keydown", listener);
    }
    expect(transactionSeenBySave).toBeNull();
    expect(textColor()).toBe("#ff0000");
    expect(history()).toBe(1);
  });

  it("the native picker commits once on its own, after a typed edit has been committed (no orphaned transaction)", () => {
    render(<Selected section={InspectorTypographySection} />);
    const input = screen.getByLabelText("Text color");
    focus(input);
    type(input, "#ff0000");
    const picker = screen.getByLabelText("Choose text color");
    // Clicking the swatch: pointerdown outside the text field ends the typed edit first.
    fireEvent.pointerDown(picker);
    expect(store().transactionSnapshot).toBeNull();
    expect(history()).toBe(1);

    fireEvent.change(picker, { target: { value: "#00aa00" } });
    expect(textColor()).toBe("#00aa00");
    expect(history()).toBe(2);
    expect(input).toHaveValue("#00aa00");
    expect(store().transactionSnapshot).toBeNull();
  });

  it.each([
    ["Background", InspectorBackgroundSection, "Background color", () => node("heading-1")?.background?.color],
    ["Border", InspectorBorderSection, "Border color", () => JSON.stringify(node("heading-1")?.border ?? null)],
  ] as const)("%s color is live with the same lifecycle", (_name, Section, label, read) => {
    render(<Selected section={Section} />);
    const before = read();
    const input = screen.getByLabelText(label);
    focus(input);
    type(input, "#ff0000");
    expect(String(read())).toContain("#ff0000");
    expect(history()).toBe(0);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(read()).toEqual(before);
    expect(history()).toBe(0);

    focus(input);
    type(input, "#00ff00");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(String(read())).toContain("#00ff00");
    expect(history()).toBe(1);
  });
});

describe("font size shows the rendered value while unset (BC-01.4)", () => {
  /** A stand-in Canvas element: jsdom has no Tailwind, so the rendered size is given inline. */
  function renderWithCanvas(px: string) {
    const surface = window.document.createElement("div");
    surface.setAttribute("data-document-surface", "");
    const heading = window.document.createElement("h1");
    heading.setAttribute("data-node-id", "heading-1");
    heading.style.fontSize = px;
    surface.append(heading);
    window.document.body.append(surface);
    const view = render(<Selected section={InspectorTypographySection} />);
    return {
      heading,
      cleanup: () => {
        view.unmount();
        surface.remove();
      },
    };
  }

  it("displays the rendered size, not 16, and leaves the property unset after focus and blur", () => {
    const { cleanup } = renderWithCanvas("30px");
    try {
      const input = screen.getByLabelText("Font size");
      expect(input).toHaveValue(30);
      focus(input);
      blur(input);
      expect(node("heading-1")?.typography).toBeUndefined();
      expect(history()).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("Arrow Up steps from the rendered value (30 -> 31), Arrow Down from it (30 -> 29); Undo and Escape return to unset", () => {
    const { cleanup } = renderWithCanvas("30px");
    try {
      const input = screen.getByLabelText("Font size");
      focus(input);
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(fontSize()).toBe(31);
      expect(node("heading-1")?.typography?.fontSize?.unit).toBe("px");
      blur(input);
      expect(history()).toBe(1);
      act(() => store().undo());
      expect(node("heading-1")?.typography).toBeUndefined();
      expect(input).toHaveValue(30);

      focus(input);
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(fontSize()).toBe(29);
      fireEvent.keyDown(input, { key: "Escape" });
      expect(node("heading-1")?.typography).toBeUndefined();
      expect(input).toHaveValue(30);
    } finally {
      cleanup();
    }
  });

  it("an authored font size is shown as authored (value and unit), never the measured one", () => {
    act(() => store().setElementTypography("heading-1", { fontSize: { value: 2, unit: "rem" } }));
    const { cleanup } = renderWithCanvas("30px");
    try {
      expect(screen.getByLabelText("Font size")).toHaveValue(2);
      expect(screen.getByLabelText("Font size unit")).toHaveValue("rem");
    } finally {
      cleanup();
    }
  });

  it("re-measures after any document change, so a changed inherited size is reflected", () => {
    const { heading, cleanup } = renderWithCanvas("30px");
    try {
      expect(screen.getByLabelText("Font size")).toHaveValue(30);
      heading.style.fontSize = "22px";
      // Any edit elsewhere in the document (e.g. on an ancestor) triggers a re-measure.
      act(() => store().setElementTypography("paragraph-1", { color: "#111111" }));
      expect(screen.getByLabelText("Font size")).toHaveValue(22);
    } finally {
      cleanup();
    }
  });
});
