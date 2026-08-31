import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OptionElement } from "./OptionElement";

describe("OptionElement (Checkpoint 1.13)", () => {
  it("renders a genuine <option>, not a div standing in for one", () => {
    render(<OptionElement node={{ id: "option-1", tag: "option", text: "Bulgaria" }} parentId="select-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const option = screen.getByRole("option", { hidden: true }) as HTMLOptionElement;
    expect(option.tagName).toBe("OPTION");
  });

  it("uses node.text as the visible label", () => {
    render(<OptionElement node={{ id: "option-1", tag: "option", text: "Bulgaria" }} parentId="select-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByRole("option", { hidden: true, name: "Bulgaria" })).toBeInTheDocument();
  });

  it("uses node.value as the native submitted value attribute", () => {
    render(
      <OptionElement node={{ id: "option-1", tag: "option", text: "Bulgaria", value: "bg" }} parentId="select-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect((screen.getByRole("option", { hidden: true }) as HTMLOptionElement).value).toBe("bg");
  });

  it("does not render a `selected` DOM attribute even when node.selected is true — the parent Select derives its own defaultValue instead", () => {
    render(
      <OptionElement node={{ id: "option-1", tag: "option", text: "Bulgaria", selected: true }} parentId="select-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );

    expect(screen.getByRole("option", { hidden: true })).not.toHaveAttribute("selected");
  });

  it("stamps stable data-node identifiers for measurement/selection tooling, matching every other primitive", () => {
    render(<OptionElement node={{ id: "option-1", tag: "option", text: "Bulgaria" }} parentId="select-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const option = screen.getByRole("option", { hidden: true });
    expect(option).toHaveAttribute("data-node-id", "option-1");
    expect(option).toHaveAttribute("data-node-type", "option");
    expect(option).toHaveAttribute("data-parent-id", "select-1");
  });
});
