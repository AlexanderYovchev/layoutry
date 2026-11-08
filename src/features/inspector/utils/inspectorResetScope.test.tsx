import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import {
  isResetCovering,
  resetFocusTarget,
  resetScopeProps,
} from "./inspectorResetScope";

function Fixture() {
  return (
    <section {...resetScopeProps} aria-label="Section">
      <button type="button">Section header</button>
      <InspectorResetButton onReset={() => undefined} label="Reset section" />
      <div {...resetScopeProps} aria-label="Row A">
        <button type="button" data-inspector-help="" aria-label="Help A" />
        <input aria-label="Field A" />
        <InspectorResetButton onReset={() => undefined} label="Reset A" />
      </div>
      <div {...resetScopeProps} aria-label="Row B">
        <button type="button" aria-pressed="false">
          Left
        </button>
        <button type="button" aria-pressed="true">
          Right
        </button>
        <InspectorResetButton onReset={() => undefined} label="Reset B" />
      </div>
    </section>
  );
}

describe("inspectorResetScope (BC-05.2)", () => {
  it("a row reset covers only its own row's field; a section reset covers every field in the section", () => {
    render(<Fixture />);
    const field = screen.getByRole("textbox", { name: "Field A" });
    expect(
      isResetCovering(screen.getByRole("button", { name: "Reset A" }), field),
    ).toBe(true);
    expect(
      isResetCovering(screen.getByRole("button", { name: "Reset B" }), field),
    ).toBe(false);
    expect(
      isResetCovering(
        screen.getByRole("button", { name: "Reset section" }),
        field,
      ),
    ).toBe(true);
    // The icon inside the button is a valid pointer target too.
    expect(
      isResetCovering(
        screen.getByRole("button", { name: "Reset A" }).querySelector("svg"),
        field,
      ),
    ).toBe(true);
    expect(
      isResetCovering(
        screen.getByRole("button", { name: "Section header" }),
        field,
      ),
    ).toBe(false);
    expect(isResetCovering(null, field)).toBe(false);
  });

  it("the focus target is the first selected option or field in document order, else the first other button — never a reset or help button", () => {
    render(<Fixture />);
    expect(resetFocusTarget(screen.getByLabelText("Row A"))).toBe(
      screen.getByRole("textbox", { name: "Field A" }),
    );
    expect(resetFocusTarget(screen.getByLabelText("Row B"))).toBe(
      screen.getByRole("button", { name: "Right" }),
    );
    const header = screen.getByRole("button", { name: "Section header" });
    const sectionScope = header.parentElement;
    if (!sectionScope) throw new Error("no section");
    // The section holds Field A too, but a section-level reset lands on the first field it holds.
    expect(resetFocusTarget(sectionScope)).toBe(
      screen.getByRole("textbox", { name: "Field A" }),
    );
  });
});

describe("resetFocusTarget in a collapsed section (BC-05.2)", () => {
  it("skips the inert body and lands on the section header", () => {
    render(
      <section {...resetScopeProps} aria-label="Collapsed">
        <button type="button">Header</button>
        <InspectorResetButton onReset={() => undefined} label="Reset all" />
        <div inert>
          <input aria-label="Hidden field" />
        </div>
      </section>,
    );
    expect(resetFocusTarget(screen.getByLabelText("Collapsed"))).toBe(
      screen.getByRole("button", { name: "Header" }),
    );
  });
});
