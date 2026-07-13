import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ResourceSidebar } from "./ResourceSidebar";

describe("ResourceSidebar", () => {
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

  it("renders the placeholder page structure tree when Structure is selected", async () => {
    const user = userEvent.setup();
    render(<ResourceSidebar />);

    await user.click(screen.getByRole("tab", { name: "Structure" }));

    const tree = within(screen.getByRole("tree", { name: "Page structure" }));
    expect(screen.getByText("Home Page")).toBeInTheDocument();
    for (const label of ["Body", "Header", "Hero", "Features", "Footer"]) {
      expect(tree.getByText(label)).toBeInTheDocument();
    }
  });
});
