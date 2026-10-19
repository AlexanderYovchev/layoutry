import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResourceCatalogPanel } from "./ResourceCatalogPanel";

describe("ResourceCatalogPanel", () => {
  it("renders the Elements library grouped by toolbar category", () => {
    render(<ResourceCatalogPanel catalogId="elements" label="Elements" />);

    for (const heading of ["HTML", "Layout", "Media", "Forms"]) {
      expect(
        screen.getByRole("heading", { level: 3, name: heading }),
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("heading", { name: "Styles" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heading" })).toBeEnabled();
  });

  it("renders the Components library grouped by Components section", () => {
    render(<ResourceCatalogPanel catalogId="components" label="Components" />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Buttons" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Primary Button" }),
    ).toBeInTheDocument();
  });

  it("filters tiles by the search query and announces the result count", async () => {
    const user = userEvent.setup();
    render(<ResourceCatalogPanel catalogId="elements" label="Elements" />);

    await user.type(
      screen.getByRole("searchbox", { name: "Search elements" }),
      "paragraph",
    );

    expect(
      screen.getByRole("button", { name: "Paragraph" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Heading" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/^\d+ results?$/)).toBeInTheDocument();
  });

  it("filters by category through an accessible radio group", async () => {
    const user = userEvent.setup();
    render(<ResourceCatalogPanel catalogId="elements" label="Elements" />);
    const filters = within(
      screen.getByRole("radiogroup", { name: "Filter elements by category" }),
    );

    expect(filters.getByRole("radio", { name: "All" })).toBeChecked();
    await user.click(filters.getByRole("radio", { name: "Forms" }));

    expect(filters.getByRole("radio", { name: "Forms" })).toBeChecked();
    expect(filters.getByRole("radio", { name: "All" })).not.toBeChecked();
    expect(
      screen.getByRole("heading", { level: 3, name: "Forms" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 3, name: "HTML" }),
    ).not.toBeInTheDocument();
  });

  it("moves the category selection with arrow keys, keeping a single tab stop", async () => {
    const user = userEvent.setup();
    render(<ResourceCatalogPanel catalogId="elements" label="Elements" />);
    const filters = within(
      screen.getByRole("radiogroup", { name: "Filter elements by category" }),
    );

    filters.getByRole("radio", { name: "All" }).focus();
    await user.keyboard("{ArrowRight}");

    const html = filters.getByRole("radio", { name: "HTML" });
    expect(html).toBeChecked();
    expect(html).toHaveFocus();
    expect(html).toHaveAttribute("tabindex", "0");
    expect(filters.getByRole("radio", { name: "All" })).toHaveAttribute(
      "tabindex",
      "-1",
    );

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(filters.getByRole("radio", { name: "Forms" })).toBeChecked();
  });

  it("shows an empty state that clears the search and filter", async () => {
    const user = userEvent.setup();
    render(<ResourceCatalogPanel catalogId="elements" label="Elements" />);
    const search = screen.getByRole("searchbox", { name: "Search elements" });

    await user.type(search, "zzz-nothing");
    expect(screen.getByText("No matches")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(search).toHaveValue("");
    expect(screen.getByRole("button", { name: "Heading" })).toBeInTheDocument();
  });

  it("clears the search with Escape", async () => {
    const user = userEvent.setup();
    render(<ResourceCatalogPanel catalogId="elements" label="Elements" />);
    const search = screen.getByRole("searchbox", { name: "Search elements" });

    await user.type(search, "head");
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
  });

  it("activates the shared click-to-insert handler for enabled tiles only", async () => {
    const user = userEvent.setup();
    const onActivateCard = vi.fn();
    render(
      <ResourceCatalogPanel
        catalogId="elements"
        label="Elements"
        onActivateCard={onActivateCard}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Heading" }));
    expect(onActivateCard).toHaveBeenCalledTimes(1);
    expect(onActivateCard.mock.calls[0][0]).toMatchObject({
      name: "Heading",
      elementType: "heading",
    });

    const disabledTile = screen
      .getAllByRole("button")
      .find((button) => button.hasAttribute("disabled"));
    expect(disabledTile).toBeDefined();
    if (disabledTile) await user.click(disabledTile);
    expect(onActivateCard).toHaveBeenCalledTimes(1);
  });
});
