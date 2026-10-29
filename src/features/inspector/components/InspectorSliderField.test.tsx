import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorSliderField } from "./InspectorSliderField";

const initialState = useEditorStore.getState();

describe("InspectorSliderField (Checkpoint 1.15.6.1.1)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("renders the slider and the paired exact-entry numeric field with the same accessible label root, plus the unit", () => {
    render(<InspectorSliderField label="Gap" value={16} min={0} max={128} unit="px" onLiveChange={() => {}} onCommit={() => {}} />);

    expect(screen.getByRole("slider", { name: "Gap" })).toHaveValue("16");
    expect(screen.getByRole("spinbutton", { name: "Gap (exact value)" })).toHaveValue(16);
    expect(screen.getByText("px")).toBeInTheDocument();
  });

  it("calls onLiveChange on every live tick while dragging, and does not call onCommit at all for a slider gesture", () => {
    const onLiveChange = vi.fn();
    const onCommit = vi.fn();
    render(<InspectorSliderField label="Opacity" value={100} min={0} max={100} onLiveChange={onLiveChange} onCommit={onCommit} />);

    const slider = screen.getByRole("slider", { name: "Opacity" });
    fireEvent.input(slider, { target: { value: "80" } });
    fireEvent.input(slider, { target: { value: "60" } });
    fireEvent.change(slider, { target: { value: "60" } });

    expect(onLiveChange).toHaveBeenNthCalledWith(1, 80);
    expect(onLiveChange).toHaveBeenNthCalledWith(2, 60);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("a full slider drag (input, input, change) is exactly one history entry via the shared begin/commitTransaction API", () => {
    render(<InspectorSliderField label="Opacity" value={100} min={0} max={100} onLiveChange={() => {}} onCommit={() => {}} />);
    const slider = screen.getByRole("slider", { name: "Opacity" });
    const historyLengthBefore = useEditorStore.getState().past.length;

    fireEvent.input(slider, { target: { value: "80" } });
    fireEvent.input(slider, { target: { value: "60" } });
    fireEvent.change(slider, { target: { value: "60" } });

    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
  });

  it("Escape mid-drag cancels the transaction (zero history) and reverts the slider's own DOM value", () => {
    render(<InspectorSliderField label="Opacity" value={100} min={0} max={100} onLiveChange={() => {}} onCommit={() => {}} />);
    const slider = screen.getByRole("slider", { name: "Opacity" }) as HTMLInputElement;
    const historyLengthBefore = useEditorStore.getState().past.length;

    fireEvent.input(slider, { target: { value: "40" } });
    fireEvent.keyDown(slider, { key: "Escape" });

    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);
    expect(useEditorStore.getState().transactionSnapshot).toBeNull();
    expect(slider.value).toBe("100");
  });

  it("committing the exact-entry numeric field calls onCommit once, without touching onLiveChange or beginning a transaction", () => {
    const onLiveChange = vi.fn();
    const onCommit = vi.fn();
    render(<InspectorSliderField label="Gap" value={16} min={0} max={128} onLiveChange={onLiveChange} onCommit={onCommit} />);

    const numberField = screen.getByRole("spinbutton", { name: "Gap (exact value)" });
    fireEvent.change(numberField, { target: { value: "42" } });
    fireEvent.blur(numberField);

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(42);
    expect(onLiveChange).not.toHaveBeenCalled();
    expect(useEditorStore.getState().transactionSnapshot).toBeNull();
  });

  it("Escape in the numeric field reverts the draft without calling onCommit", () => {
    const onCommit = vi.fn();
    render(<InspectorSliderField label="Gap" value={16} min={0} max={128} onLiveChange={() => {}} onCommit={onCommit} />);

    const numberField = screen.getByRole("spinbutton", { name: "Gap (exact value)" });
    fireEvent.change(numberField, { target: { value: "999" } });
    fireEvent.keyDown(numberField, { key: "Escape" });

    expect(onCommit).not.toHaveBeenCalled();
    expect(numberField).toHaveValue(16);
  });

  it("clamps a numeric entry outside min/max before committing", () => {
    const onCommit = vi.fn();
    render(<InspectorSliderField label="Opacity" value={50} min={0} max={100} onLiveChange={() => {}} onCommit={onCommit} />);

    const numberField = screen.getByRole("spinbutton", { name: "Opacity (exact value)" });
    fireEvent.change(numberField, { target: { value: "500" } });
    fireEvent.blur(numberField);

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(100);
  });

  it("shows Mixed for a null value (bulk multi-selection with differing values) instead of pretending there's one current value", () => {
    render(<InspectorSliderField label="Gap" value={null} min={0} max={128} onLiveChange={() => {}} onCommit={() => {}} />);

    const numberField = screen.getByRole("spinbutton", { name: "Gap (exact value)" });
    expect(numberField).toHaveValue(null);
    expect(numberField).toHaveAttribute("placeholder", "Mixed");
  });

  it("disables both the slider and the numeric field when disabled (Parent Style Protection composes with this via the same inert wrapper every other CSS control already uses)", () => {
    render(<InspectorSliderField label="Opacity" value={50} min={0} max={100} disabled onLiveChange={() => {}} onCommit={() => {}} />);

    expect(screen.getByRole("slider", { name: "Opacity" })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "Opacity (exact value)" })).toBeDisabled();
  });

  it("stays in sync when the external value changes (undo/redo, another control, a fresh selection)", () => {
    const { rerender } = render(<InspectorSliderField label="Gap" value={16} min={0} max={128} onLiveChange={() => {}} onCommit={() => {}} />);
    rerender(<InspectorSliderField label="Gap" value={64} min={0} max={128} onLiveChange={() => {}} onCommit={() => {}} />);

    expect(screen.getByRole("slider", { name: "Gap" })).toHaveValue("64");
    expect(screen.getByRole("spinbutton", { name: "Gap (exact value)" })).toHaveValue(64);
  });

  // BC-01.2 regressions — focus first, so Enter/Escape .blur() dispatches
  // the real blur event that used to run a second commit.
  describe("exact-value field on a focused input (BC-01.2)", () => {
    it("Escape discards a changed value without committing", () => {
      const onCommit = vi.fn();
      render(<InspectorSliderField label="Opacity" value={100} min={0} max={100} onLiveChange={() => {}} onCommit={onCommit} />);

      const numberField = screen.getByRole("spinbutton", { name: "Opacity (exact value)" });
      numberField.focus();
      fireEvent.change(numberField, { target: { value: "25" } });
      fireEvent.keyDown(numberField, { key: "Escape" });

      expect(onCommit).not.toHaveBeenCalled();
      expect(numberField).toHaveValue(100);
      expect(numberField).not.toHaveFocus();
    });

    it("Enter commits a changed value exactly once", () => {
      const onCommit = vi.fn();
      render(<InspectorSliderField label="Opacity" value={100} min={0} max={100} onLiveChange={() => {}} onCommit={onCommit} />);

      const numberField = screen.getByRole("spinbutton", { name: "Opacity (exact value)" });
      numberField.focus();
      fireEvent.change(numberField, { target: { value: "40" } });
      fireEvent.keyDown(numberField, { key: "Enter" });

      expect(onCommit).toHaveBeenCalledExactlyOnceWith(40);
    });

    it("a plain blur after editing commits exactly once, clamped", () => {
      const onCommit = vi.fn();
      render(<InspectorSliderField label="Gap" value={16} min={0} max={128} onLiveChange={() => {}} onCommit={onCommit} />);

      const numberField = screen.getByRole("spinbutton", { name: "Gap (exact value)" });
      numberField.focus();
      fireEvent.change(numberField, { target: { value: "-5" } });
      numberField.blur();

      expect(onCommit).toHaveBeenCalledExactlyOnceWith(0);
    });

    it("focus then blur, or focus then Enter, with no edit never commits", () => {
      const onCommit = vi.fn();
      render(<InspectorSliderField label="Gap" value={16} min={0} max={128} onLiveChange={() => {}} onCommit={onCommit} />);

      const numberField = screen.getByRole("spinbutton", { name: "Gap (exact value)" });
      numberField.focus();
      numberField.blur();
      numberField.focus();
      fireEvent.keyDown(numberField, { key: "Enter" });

      expect(onCommit).not.toHaveBeenCalled();
    });

    it("an empty draft reverts on Enter instead of committing", () => {
      const onCommit = vi.fn();
      render(<InspectorSliderField label="Gap" value={16} min={0} max={128} onLiveChange={() => {}} onCommit={onCommit} />);

      const numberField = screen.getByRole("spinbutton", { name: "Gap (exact value)" });
      numberField.focus();
      fireEvent.change(numberField, { target: { value: "" } });
      fireEvent.keyDown(numberField, { key: "Enter" });

      expect(onCommit).not.toHaveBeenCalled();
      expect(numberField).toHaveValue(16);
    });

    it("never opens a slider transaction from the exact-value field", () => {
      render(<InspectorSliderField label="Opacity" value={100} min={0} max={100} onLiveChange={() => {}} onCommit={() => {}} />);

      const numberField = screen.getByRole("spinbutton", { name: "Opacity (exact value)" });
      numberField.focus();
      fireEvent.change(numberField, { target: { value: "30" } });
      fireEvent.keyDown(numberField, { key: "Escape" });

      expect(useEditorStore.getState().transactionSnapshot).toBeNull();
    });
  });
});
