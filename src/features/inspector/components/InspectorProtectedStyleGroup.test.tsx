import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InspectorProtectedStyleGroup } from "./InspectorProtectedStyleGroup";

describe("InspectorProtectedStyleGroup", () => {
  it("renders children unwrapped (fully interactive) when not protected", () => {
    const { container } = render(
      <InspectorProtectedStyleGroup protected={false}>
        <button type="button">Field</button>
      </InspectorProtectedStyleGroup>,
    );
    expect(screen.getByText("Field")).toBeInTheDocument();
    expect(container.querySelector('[aria-disabled="true"]')).not.toBeInTheDocument();
    expect(container.querySelector("[inert]")).not.toBeInTheDocument();
  });

  it("wraps children in a visible-but-inert group when protected (blocks keyboard focus/typing, not just mouse)", () => {
    const { container } = render(
      <InspectorProtectedStyleGroup protected={true}>
        <button type="button">Field</button>
      </InspectorProtectedStyleGroup>,
    );
    expect(screen.getByText("Field")).toBeInTheDocument();
    const wrapper = container.querySelector('[aria-disabled="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute("inert");
  });
});
