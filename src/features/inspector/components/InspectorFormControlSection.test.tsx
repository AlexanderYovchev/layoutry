import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { InputType } from "@/features/editor/types/input";
import { InspectorFormControlSection } from "./InspectorFormControlSection";

const initialState = useEditorStore.getState();

// Mirrors InspectorLinkSection.test.tsx's own ConnectedSection — subscribes
// to the store so each commit sees the freshly-updated node.
function ConnectedSection({ id }: { id: string }) {
  const node = useEditorStore((state) => state.document.children?.find((c) => c.id === id));
  if (!node) return null;
  return <InspectorFormControlSection node={node} />;
}

function setup(node: { id: string; tag: string; inputType?: InputType; name?: string; placeholder?: string; value?: string; checked?: boolean }) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [{ ...node }] },
  }));
  return render(<ConnectedSection id={node.id} />);
}

function currentNode(id: string) {
  return useEditorStore.getState().document.children?.find((c) => c.id === id);
}

describe("InspectorFormControlSection (Checkpoint 1.10)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Name, Placeholder, and Default Value fields with the node's current values", () => {
    setup({ id: "input-1", tag: "input", name: "email", placeholder: "Enter your email", value: "test@example.com" });

    expect(screen.getByLabelText("Name")).toHaveValue("email");
    expect(screen.getByLabelText("Placeholder")).toHaveValue("Enter your email");
    expect(screen.getByLabelText("Default Value")).toHaveValue("test@example.com");
  });

  it("shows all three fields empty when unset", () => {
    setup({ id: "input-1", tag: "input" });

    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Placeholder")).toHaveValue("");
    expect(screen.getByLabelText("Default Value")).toHaveValue("");
  });

  it("commits Name through setElementName on blur", () => {
    setup({ id: "input-1", tag: "input" });

    const field = screen.getByLabelText("Name");
    fireEvent.change(field, { target: { value: "email" } });
    fireEvent.blur(field);

    expect(currentNode("input-1")?.name).toBe("email");
  });

  it("commits Placeholder through setElementPlaceholder on Enter", () => {
    setup({ id: "input-1", tag: "input" });

    const field = screen.getByLabelText("Placeholder");
    fireEvent.change(field, { target: { value: "you@example.com" } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(currentNode("input-1")?.placeholder).toBe("you@example.com");
  });

  it("commits Default Value through setElementValue on blur", () => {
    setup({ id: "input-1", tag: "input" });

    const field = screen.getByLabelText("Default Value");
    fireEvent.change(field, { target: { value: "test@example.com" } });
    fireEvent.blur(field);

    expect(currentNode("input-1")?.value).toBe("test@example.com");
  });

  it("Escape reverts a field's draft without committing", () => {
    setup({ id: "input-1", tag: "input", name: "email" });

    const field = screen.getByLabelText("Name");
    fireEvent.change(field, { target: { value: "discarded" } });
    fireEvent.keyDown(field, { key: "Escape" });

    expect(field).toHaveValue("email");
    expect(currentNode("input-1")?.name).toBe("email");
  });

  it("does not commit an unchanged field on blur (avoids a spurious history entry)", () => {
    setup({ id: "input-1", tag: "input", placeholder: "Enter text" });
    const pastLengthBefore = useEditorStore.getState().past.length;

    fireEvent.blur(screen.getByLabelText("Placeholder"));

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });

  it("Reset clears an explicit value back to unset for each field independently", () => {
    setup({ id: "input-1", tag: "input", name: "email", placeholder: "Enter your email", value: "test@example.com" });

    fireEvent.click(screen.getByRole("button", { name: "Reset name" }));
    expect(currentNode("input-1")?.name).toBeUndefined();
    expect(currentNode("input-1")?.placeholder).toBe("Enter your email");
    expect(currentNode("input-1")?.value).toBe("test@example.com");
  });

  it("Reset is disabled when there is no explicit value to remove", () => {
    setup({ id: "input-1", tag: "input" });
    expect(screen.getByRole("button", { name: "Reset name" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset placeholder" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset default value" })).toBeDisabled();
  });
});

describe("InspectorFormControlSection — Input Type (Checkpoint 1.11)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the current inputType, defaulting to Text when unset", () => {
    setup({ id: "input-1", tag: "input" });
    expect(screen.getByLabelText("Type")).toHaveValue("text");
  });

  it("offers every InputType as an option, including checkbox/radio (Checkpoint 1.12 — cross-family switching)", () => {
    setup({ id: "input-1", tag: "input" });
    const select = screen.getByLabelText("Type") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(["text", "email", "password", "number", "search", "url", "tel", "checkbox", "radio"]);
  });

  it("changing Type commits through setElementInputType and re-renders immediately", () => {
    setup({ id: "input-1", tag: "input", inputType: "text" });

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "email" } });

    expect(currentNode("input-1")?.inputType).toBe("email");
    expect(screen.getByLabelText("Type")).toHaveValue("email");
  });

  it("changing Type preserves Name/Placeholder/Default Value", () => {
    setup({ id: "input-1", tag: "input", inputType: "text", name: "contact", placeholder: "Enter contact", value: "hello" });

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "tel" } });

    expect(currentNode("input-1")?.name).toBe("contact");
    expect(currentNode("input-1")?.placeholder).toBe("Enter contact");
    expect(currentNode("input-1")?.value).toBe("hello");
  });

  it("changing Type pushes exactly one history entry, and it's undoable", () => {
    setup({ id: "input-1", tag: "input", inputType: "text" });
    const pastLengthBefore = useEditorStore.getState().past.length;

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "number" } });

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
    useEditorStore.getState().undo();
    expect(currentNode("input-1")?.inputType).toBe("text");
  });

  it("re-selecting the already-active type creates no history entry (no-op guard)", () => {
    setup({ id: "input-1", tag: "input", inputType: "text" });
    const pastLengthBefore = useEditorStore.getState().past.length;

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "text" } });

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });
});

describe("InspectorFormControlSection — Checkbox/Radio + Textarea (Checkpoint 1.12)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("hides Placeholder and shows Checked for a checkbox", () => {
    setup({ id: "input-1", tag: "input", inputType: "checkbox" });

    expect(screen.queryByLabelText("Placeholder")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Checked" })).toBeInTheDocument();
  });

  it("hides Placeholder and shows Checked for a radio", () => {
    setup({ id: "input-1", tag: "input", inputType: "radio" });

    expect(screen.queryByLabelText("Placeholder")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Checked" })).toBeInTheDocument();
  });

  it("still shows Name and Default Value for a checkbox — only Placeholder is hidden", () => {
    setup({ id: "input-1", tag: "input", inputType: "checkbox" });

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Default Value")).toBeInTheDocument();
  });

  it("omits Checked for text-like Input types", () => {
    setup({ id: "input-1", tag: "input", inputType: "email" });
    expect(screen.queryByRole("switch", { name: "Checked" })).not.toBeInTheDocument();
  });

  it("reflects the current checked state on the toggle", () => {
    setup({ id: "input-1", tag: "input", inputType: "checkbox", checked: true });
    expect(screen.getByRole("switch", { name: "Checked" })).toHaveAttribute("aria-checked", "true");
  });

  it("defaults the toggle to unchecked when checked is unset", () => {
    setup({ id: "input-1", tag: "input", inputType: "checkbox" });
    expect(screen.getByRole("switch", { name: "Checked" })).toHaveAttribute("aria-checked", "false");
  });

  it("toggling Checked commits through setElementChecked and pushes exactly one history entry, undoable", () => {
    setup({ id: "input-1", tag: "input", inputType: "checkbox" });
    const pastLengthBefore = useEditorStore.getState().past.length;

    fireEvent.click(screen.getByRole("switch", { name: "Checked" }));

    expect(currentNode("input-1")?.checked).toBe(true);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    expect(currentNode("input-1")?.checked).toBeUndefined();
  });

  it("toggling Checked off commits false explicitly", () => {
    setup({ id: "input-1", tag: "input", inputType: "checkbox", checked: true });

    fireEvent.click(screen.getByRole("switch", { name: "Checked" }));

    expect(currentNode("input-1")?.checked).toBe(false);
  });

  it("switching Type away from checkbox does not delete the stored Placeholder — it only becomes hidden (non-destructive type switching)", () => {
    setup({ id: "input-1", tag: "input", inputType: "text", placeholder: "Email", name: "newsletter" });
    // Establish a stored placeholder on a text-like type first, then
    // switch to checkbox (hides Placeholder in the UI) and back.
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "checkbox" } });
    expect(currentNode("input-1")?.placeholder).toBe("Email");
    expect(screen.queryByLabelText("Placeholder")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "text" } });
    expect(currentNode("input-1")?.placeholder).toBe("Email");
    expect(screen.getByLabelText("Placeholder")).toHaveValue("Email");
  });

  it("switching Type away from checkbox does not delete a stored Checked state — it only becomes hidden", () => {
    setup({ id: "input-1", tag: "input", inputType: "checkbox", checked: true });

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "text" } });
    expect(currentNode("input-1")?.checked).toBe(true);
    expect(screen.queryByRole("switch", { name: "Checked" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "checkbox" } });
    expect(screen.getByRole("switch", { name: "Checked" })).toHaveAttribute("aria-checked", "true");
  });

  it("omits the Type field entirely for Textarea — it has no inputType concept", () => {
    setup({ id: "textarea-1", tag: "textarea" });
    expect(screen.queryByLabelText("Type")).not.toBeInTheDocument();
  });

  it("shows Name, Placeholder, and Default Value for Textarea, same as text-like Input", () => {
    setup({ id: "textarea-1", tag: "textarea", name: "message", placeholder: "Write your message", value: "hello" });

    expect(screen.getByLabelText("Name")).toHaveValue("message");
    expect(screen.getByLabelText("Placeholder")).toHaveValue("Write your message");
    expect(screen.getByLabelText("Default Value")).toHaveValue("hello");
  });

  it("omits Checked for Textarea", () => {
    setup({ id: "textarea-1", tag: "textarea" });
    expect(screen.queryByRole("switch", { name: "Checked" })).not.toBeInTheDocument();
  });
});

describe("InspectorFormControlSection — Select (Checkpoint 1.13)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows only Name for Select — Type/Placeholder/Default Value/Checked are all hidden", () => {
    setup({ id: "select-1", tag: "select", name: "country" });

    expect(screen.getByLabelText("Name")).toHaveValue("country");
    expect(screen.queryByLabelText("Type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Placeholder")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Default Value")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Checked" })).not.toBeInTheDocument();
  });

  it("commits Name for Select through setElementName, one history entry", () => {
    setup({ id: "select-1", tag: "select" });
    const pastLengthBefore = useEditorStore.getState().past.length;

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "country" } });
    fireEvent.blur(screen.getByLabelText("Name"));

    expect(currentNode("select-1")?.name).toBe("country");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
  });
});
