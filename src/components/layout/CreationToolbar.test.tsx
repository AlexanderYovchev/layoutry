import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

    expect(htmlTrigger).toHaveAttribute("aria-expanded", "false");
    // The panel lingers briefly to play its exit fade rather than
    // disappearing the instant it's closed.
    await waitFor(() =>
      expect(
        screen.queryByRole("menu", { name: "HTML elements" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the documented placeholder sections inside the HTML dropdown (Checkpoint 1.15.1: Forms/Media moved to their own categories, replaced here by Interactive)", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    const menu = within(screen.getByRole("menu", { name: "HTML elements" }));

    for (const section of [
      "Containers",
      "Typography",
      "Navigation",
      "Lists",
      "Interactive",
      "Tables",
      "Semantic Elements",
    ]) {
      expect(menu.getByText(section)).toBeInTheDocument();
    }
  });

  it("shows a placeholder card with a name and description for each future element", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    const menu = within(screen.getByRole("menu", { name: "HTML elements" }));

    expect(menu.getByText("Container")).toBeInTheDocument();
    expect(menu.getByText("Generic layout container")).toBeInTheDocument();
  });

  it("shows a non-functional search field at the top of each catalog", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "HTML" }));

    const searchField = screen.getByPlaceholderText("Search html");
    expect(searchField).toBeDisabled();
  });

  it("switches directly to another category when a different trigger is clicked", async () => {
    // fireEvent isolates the discrete click from simulated hover, which is
    // covered separately below.
    render(<CreationToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "HTML" }));
    expect(
      screen.getByRole("menu", { name: "HTML elements" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Layout" }));

    expect(
      screen.getByRole("menu", { name: "Layout elements" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("menu", { name: "HTML elements" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("switches categories on hover once one is already open", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.hover(screen.getByRole("button", { name: "Media" }));

    expect(
      screen.getByRole("menu", { name: "Media elements" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("menu", { name: "HTML elements" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("closes the open dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "Forms" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(document.body);

    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("closes with Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    const stylesTrigger = screen.getByRole("button", { name: "Styles" });
    await user.click(stylesTrigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(stylesTrigger).toHaveFocus();
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
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

  it("never activates the disabled placeholder cards", async () => {
    const user = userEvent.setup();
    render(<CreationToolbar />);

    await user.click(screen.getByRole("button", { name: "Components" }));
    const menu = within(
      screen.getByRole("menu", { name: "Components elements" }),
    );
    const cards = menu.getAllByRole("menuitem");
    expect(cards.length).toBeGreaterThan(0);
    // Buttons (Checkpoint 1.15.6.2), Navigation (Checkpoint 1.15.6.3),
    // Cards & Containers (Checkpoint 1.15.6.4), Forms & Inputs
    // (Checkpoint 1.15.6.5), Data Display (Checkpoint 1.15.6.6), and
    // Interactive (Checkpoint 1.15.6.8) are the first six real, enabled
    // Components families — Feedback & Overlays remains a disabled future
    // placeholder, and "Panel" remains a disabled placeholder within
    // Cards & Containers itself (audited in 1.15.6.6 and deliberately
    // left disabled — see that checkpoint's report).
    const enabledCardNames = [
      "Primary Button",
      "Secondary Button",
      "Outline Button",
      "Ghost Button",
      "Button Group",
      "Dropdown Button",
      "Basic Navbar",
      "Navbar with CTA",
      "Centered Navbar",
      "Breadcrumbs",
      "Pagination",
      "Sidebar Navigation",
      "Basic Card",
      "Image Card",
      "Horizontal Card",
      "Profile Card",
      "Feature Card",
      "Pricing Card",
      "Labeled Text Field",
      "Search Bar",
      "Newsletter Signup",
      "Contact Form",
      "Login Form",
      "Labeled Select Field",
      "Badge",
      "Avatar",
      "Avatar with Text",
      "Stat Card",
      "Metadata Row",
      "Collapsible",
    ];
    for (const card of cards) {
      const isEnabledCard = enabledCardNames.some((name) => card.textContent?.startsWith(name));
      if (isEnabledCard) {
        expect(card).toBeEnabled();
      } else {
        expect(card).toBeDisabled();
      }
    }
  });
});
