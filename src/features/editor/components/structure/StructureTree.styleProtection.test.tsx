import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { StructureTree } from "./StructureTree";

const initialState = useEditorStore.getState();

describe("StructureTree — lock badge (Checkpoint 1.15.3, section 42)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows no lock badge by default", () => {
    render(<StructureTree />);
    expect(screen.queryByLabelText("Lock child styles is on")).not.toBeInTheDocument();
  });

  it("shows a lock badge on the owner row when lockChildStyles is on", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: state.document.children!.map((child, index) => (index === 0 ? { ...child, lockChildStyles: true } : child)),
      },
    }));
    render(<StructureTree />);
    expect(screen.getByLabelText("Lock child styles is on")).toBeInTheDocument();
  });
});
