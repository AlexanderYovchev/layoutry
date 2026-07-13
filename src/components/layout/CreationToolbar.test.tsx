import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CreationToolbar } from "./CreationToolbar";

describe("CreationToolbar", () => {
  it("exposes the toolbar and its six category triggers", () => {
    render(<CreationToolbar />);

    expect(
      screen.getByRole("toolbar", { name: "Creation toolbar" }),
    ).toBeInTheDocument();
    for (const label of [
      "HTML",
      "Components",
      "Layout",
      "Media",
      "Forms",
      "Styles",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByPlaceholderText("Search elements")).toBeInTheDocument();
  });

  it("opens a category dropdown on click and closes it when clicked again", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    const htmlTrigger = screen.getByRole("button", { name: "HTML" });
    await user.click(htmlTrigger);

    expect(
      screen.getByRole("menu", { name: "HTML elements" }),
    ).toBeInTheDocument();
    expect(htmlTrigger).toHaveAttribute("aria-expanded", "true");

    await user.click(htmlTrigger);

    expect(
      screen.queryByRole("menu", { name: "HTML elements" }),
    ).not.toBeInTheDocument();
    expect(htmlTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the documented placeholder sections inside the HTML dropdown", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    const menu = within(screen.getByRole("menu", { name: "HTML elements" }));

    for (const section of [
      "Containers",
      "Typography",
      "Navigation",
      "Lists",
      "Forms",
      "Media",
      "Tables",
      "Semantic Elements",
    ]) {
      expect(menu.getByText(section)).toBeInTheDocument();
    }
    expect(menu.getAllByText("(TBD)").length).toBeGreaterThan(0);
  });

  it("switches directly to another category when a different trigger is clicked", () => {
    // fireEvent isolates the discrete click from simulated hover, which is
    // covered separately below.
    render(<CreationToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "HTML" }));
    expect(
      screen.getByRole("menu", { name: "HTML elements" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Layout" }));

    expect(
      screen.queryByRole("menu", { name: "HTML elements" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menu", { name: "Layout elements" }),
    ).toBeInTheDocument();
  });

  it("switches categories on hover once one is already open", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.hover(screen.getByRole("button", { name: "Media" }));

    expect(
      screen.queryByRole("menu", { name: "HTML elements" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menu", { name: "Media elements" }),
    ).toBeInTheDocument();
  });

  it("closes the open dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "Forms" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes with Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    const stylesTrigger = screen.getByRole("button", { name: "Styles" });
    await user.click(stylesTrigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(stylesTrigger).toHaveFocus();
  });

  it("moves focus between category triggers with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    const htmlTrigger = screen.getByRole("button", { name: "HTML" });
    htmlTrigger.focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Components" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(htmlTrigger).toHaveFocus();
  });

  it("never activates the disabled placeholder rows", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "Components" }));
    const rows = screen.getAllByRole("menuitem", { name: "(TBD)" });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toBeDisabled();
    }
  });
});
