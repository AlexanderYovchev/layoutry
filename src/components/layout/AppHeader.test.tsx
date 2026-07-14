import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";
import type { ViewState } from "./applicationMenus";

const defaultViewState: ViewState = {
  resourcePanelVisible: true,
  inspectorPanelVisible: true,
  statusBarVisible: true,
};

function renderAppHeader(viewState: ViewState = defaultViewState) {
  const onToggleView = vi.fn();
  render(<AppHeader viewState={viewState} onToggleView={onToggleView} />);
  return { onToggleView };
}

describe("AppHeader", () => {
  it("identifies the product and exposes the application menu bar", () => {
    renderAppHeader();

    const banner = screen.getByRole("banner", { name: "Application menu bar" });
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText("Layoutry")).toBeInTheDocument();
    expect(
      screen.getByRole("menubar", { name: "Application menu" }),
    ).toBeInTheDocument();
    for (const label of ["File", "Edit", "View", "Insert", "Project", "Help"]) {
      expect(screen.getByRole("menuitem", { name: label })).toBeInTheDocument();
    }
  });

  it("opens a menu on click and closes it when the same trigger is clicked again", async () => {
    const user = userEvent.setup();
    renderAppHeader();

    const fileTrigger = screen.getByRole("menuitem", { name: "File" });
    await user.click(fileTrigger);

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(fileTrigger).toHaveAttribute("aria-expanded", "true");

    await user.click(fileTrigger);

    expect(fileTrigger).toHaveAttribute("aria-expanded", "false");
    // The dropdown lingers briefly to play its exit fade rather than
    // disappearing the instant it's closed.
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("switches directly to another top-level menu when a different trigger is clicked", async () => {
    // Uses fireEvent (a single discrete click, no simulated pointer travel) to
    // isolate click-to-switch behavior from mouse hover-switching, which is
    // exercised separately and would otherwise already open "Edit" on the way.
    renderAppHeader();

    fireEvent.click(screen.getByRole("menuitem", { name: "File" }));
    expect(
      screen.getByRole("menuitem", { name: "New Project" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(screen.getByRole("menuitem", { name: "Undo" })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("menuitem", { name: "New Project" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("switches to another top-level menu on hover once a menu is already open", async () => {
    const user = userEvent.setup();
    renderAppHeader();

    await user.click(screen.getByRole("menuitem", { name: "File" }));
    expect(
      screen.getByRole("menuitem", { name: "New Project" }),
    ).toBeInTheDocument();

    await user.hover(screen.getByRole("menuitem", { name: "Edit" }));

    expect(screen.getByRole("menuitem", { name: "Undo" })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("menuitem", { name: "New Project" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("closes the open menu when clicking outside", async () => {
    const user = userEvent.setup();
    renderAppHeader();

    await user.click(screen.getByRole("menuitem", { name: "File" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(document.body);

    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("closes the open menu with Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderAppHeader();

    const fileTrigger = screen.getByRole("menuitem", { name: "File" });
    await user.click(fileTrigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(fileTrigger).toHaveFocus();
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("does not activate disabled items and leaves the menu open", async () => {
    const user = userEvent.setup();
    renderAppHeader();

    await user.click(screen.getByRole("menuitem", { name: "File" }));
    const saveItem = screen.getByRole("menuitem", { name: "Save" });
    expect(saveItem).toBeDisabled();

    await user.click(saveItem);

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("moves through enabled items with the keyboard, skipping disabled ones", async () => {
    // The Help menu has enabled commands (Getting Started, Keyboard Shortcuts,
    // About Layoutry) separated by several disabled placeholders, making it a
    // good candidate for verifying that disabled items are skipped entirely.
    const user = userEvent.setup();
    renderAppHeader();

    const helpTrigger = screen.getByRole("menuitem", { name: "Help" });
    helpTrigger.focus();
    await user.keyboard("{ArrowDown}");

    expect(
      screen.getByRole("menuitem", { name: "Getting Started" }),
    ).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("menuitem", { name: "Keyboard Shortcuts" }),
    ).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("menuitem", { name: "About Layoutry" }),
    ).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(
      screen.getByRole("menuitem", { name: "Keyboard Shortcuts" }),
    ).toHaveFocus();
  });

  it("exposes checked state for view toggles and calls onToggleView on selection", async () => {
    const user = userEvent.setup();
    const { onToggleView } = renderAppHeader();

    await user.click(screen.getByRole("menuitem", { name: "View" }));
    const resourcePanelItem = screen.getByRole("menuitemcheckbox", {
      name: "Resource Panel",
    });
    expect(resourcePanelItem).toHaveAttribute("aria-checked", "true");

    await user.click(resourcePanelItem);

    expect(onToggleView).toHaveBeenCalledWith("resourcePanelVisible");
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("reflects unchecked view state", async () => {
    const user = userEvent.setup();
    renderAppHeader({ ...defaultViewState, statusBarVisible: false });

    await user.click(screen.getByRole("menuitem", { name: "View" }));

    expect(
      screen.getByRole("menuitemcheckbox", { name: "Status Bar" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("opens the Open Recent submenu and shows its honest empty state", async () => {
    const user = userEvent.setup();
    renderAppHeader();

    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.click(screen.getByRole("menuitem", { name: "Open Recent" }));

    const emptyItem = screen.getByRole("menuitem", {
      name: "No recent projects",
    });
    expect(emptyItem).toBeInTheDocument();
    expect(emptyItem).toBeDisabled();
  });

  it("opens and closes the About dialog from the Help menu, restoring focus", async () => {
    const user = userEvent.setup();
    renderAppHeader();

    const helpTrigger = screen.getByRole("menuitem", { name: "Help" });
    await user.click(helpTrigger);
    await user.click(screen.getByRole("menuitem", { name: "About Layoutry" }));

    const dialog = await screen.findByRole("dialog", {
      name: "About Layoutry",
    });
    expect(within(dialog).getByText("Layoutry")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the project name truncatable so a long name can't push actions out of view", () => {
    renderAppHeader();

    const projectName = screen.getByText("Untitled Project");
    expect(projectName).toHaveClass("truncate");
    // min-w-0 overrides the flex-item default (min-width: auto), which is
    // what actually lets this region shrink and truncate instead of
    // forcing the header wider than the viewport.
    expect(projectName.parentElement).toHaveClass("min-w-0", "flex-1");
  });
});
