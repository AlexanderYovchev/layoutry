import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ResourceSidebar } from "./ResourceSidebar";

describe("ResourceSidebar", () => {
  afterEach(() => {
    window.localStorage.removeItem("layoutry:resource-panel-width");
  });

  it("shows the six navigation items with Elements active by default", () => {
    render(<ResourceSidebar />);

    const rail = within(
      screen.getByRole("tablist", { name: "Resource categories" }),
    );
    for (const label of [
      "Elements",
      "Components",
      "Templates",
      "Structure",
      "Assets",
      "Favorites",
    ]) {
      expect(rail.getByRole("tab", { name: label })).toBeInTheDocument();
    }

    expect(rail.getByRole("tab", { name: "Elements" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText(
        "This area will contain the complete HTML element library.",
      ),
    ).toBeInTheDocument();
  });

  it("switches the context panel content when a different navigation item is clicked", async () => {
    const user = userEvent.setup();
    render(<ResourceSidebar />);

    await user.click(screen.getByRole("tab", { name: "Assets" }));

    expect(screen.getByRole("tab", { name: "Assets" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Elements" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(
      screen.getByText("This area will contain uploaded assets."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "This area will contain the complete HTML element library.",
      ),
    ).not.toBeInTheDocument();
  });

  it("moves focus between navigation items with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<ResourceSidebar />);

    const elementsTab = screen.getByRole("tab", { name: "Elements" });
    elementsTab.focus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Components" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(elementsTab).toHaveFocus();
  });

  it("renders the provided structureContent when Structure is selected, and only then", async () => {
    const user = userEvent.setup();
    render(
      <ResourceSidebar structureContent={<div>mock structure panel</div>} />,
    );

    expect(screen.queryByText("mock structure panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Structure" }));

    expect(screen.getByText("mock structure panel")).toBeInTheDocument();
  });

  it("grows when its resize handle is dragged to the right", () => {
    render(<ResourceSidebar />);

    const panel = screen.getByRole("complementary", { name: "Resource panel" });
    const handle = screen.getByRole("separator");

    expect(panel.style.width).toBe("280px");

    fireEvent.pointerDown(handle, { clientX: 100 });
    fireEvent.pointerMove(handle, { clientX: 160 });
    fireEvent.pointerUp(handle, { clientX: 160 });

    expect(panel.style.width).toBe("340px");
  });
});
